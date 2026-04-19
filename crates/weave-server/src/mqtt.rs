use std::sync::Arc;

use rumqttc::{AsyncClient, EventLoop, MqttOptions, QoS};

use weave_contracts::Glyph;
use weave_engine::{InputPrimitive, RoutedIntent, RoutingEngine};

/// Publish a glyph as a retained message at `system/glyphs/{name}`. MQTT
/// consumers (nuimo-mqtt etc.) subscribe to `system/glyphs/+` to hydrate
/// their local registry.
pub async fn publish_glyph(client: &AsyncClient, glyph: &Glyph) {
    let topic = format!("system/glyphs/{}", glyph.name);
    match serde_json::to_vec(glyph) {
        Ok(payload) => {
            if let Err(e) = client
                .publish(&topic, QoS::AtLeastOnce, true, payload)
                .await
            {
                tracing::warn!(%topic, error = %e, "failed to publish glyph");
            }
        }
        Err(e) => tracing::warn!(error = %e, "failed to serialize glyph"),
    }
}

/// Publish an empty retained message to drop the glyph from subscribers.
pub async fn publish_glyph_delete(client: &AsyncClient, name: &str) {
    let topic = format!("system/glyphs/{}", name);
    if let Err(e) = client
        .publish(&topic, QoS::AtLeastOnce, true, Vec::new())
        .await
    {
        tracing::warn!(%topic, error = %e, "failed to tombstone glyph");
    }
}

/// Incoming device event parsed from MQTT.
#[derive(Debug)]
pub struct DeviceEvent {
    pub device_type: String,
    pub device_id: String,
    pub input: InputPrimitive,
}

/// MQTT bridge: subscribes to device topics, publishes service intents and feedback.
pub struct MqttBridge {
    client: AsyncClient,
    event_loop: EventLoop,
}

impl MqttBridge {
    pub fn new(host: &str, port: u16) -> Self {
        let mut opts = MqttOptions::new("weave", host, port);
        opts.set_keep_alive(std::time::Duration::from_secs(30));
        let (client, event_loop) = AsyncClient::new(opts, 128);
        MqttBridge { client, event_loop }
    }

    pub async fn start(
        mut self,
        engine: Arc<RoutingEngine>,
    ) -> anyhow::Result<AsyncClient> {
        // Subscribe to all device input topics
        self.client
            .subscribe("device/+/+/input/#", QoS::AtLeastOnce)
            .await?;
        // Subscribe to all service state topics (for feedback relay)
        self.client
            .subscribe("service/+/+/state/#", QoS::AtLeastOnce)
            .await?;

        let client = self.client.clone();
        let publish_client = client.clone();

        tokio::spawn(async move {
            loop {
                match self.event_loop.poll().await {
                    Ok(rumqttc::Event::Incoming(rumqttc::Packet::Publish(msg))) => {
                        let topic = msg.topic.clone();
                        let payload = msg.payload.to_vec();

                        if topic.starts_with("device/") {
                            if let Some(event) = parse_device_topic(&topic, &payload) {
                                let routed = engine
                                    .route(&event.device_type, &event.device_id, &event.input)
                                    .await;
                                for intent in routed {
                                    publish_intent(&publish_client, &intent).await;
                                }
                            }
                        }
                        // Feedback relay (service state → device feedback) handled separately
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::warn!("MQTT error: {}", e);
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    }
                }
            }
        });

        Ok(client)
    }
}

/// Parse `device/{type}/{id}/input/{primitive}` topic + payload into a DeviceEvent.
fn parse_device_topic(topic: &str, payload: &[u8]) -> Option<DeviceEvent> {
    let parts: Vec<&str> = topic.split('/').collect();
    // device/{type}/{id}/input/{primitive_name}
    if parts.len() < 5 || parts[0] != "device" || parts[3] != "input" {
        return None;
    }

    let device_type = parts[1].to_string();
    let device_id = parts[2].to_string();
    let primitive_name = parts[4];

    let payload_json: serde_json::Value =
        serde_json::from_slice(payload).unwrap_or(serde_json::json!({}));

    let input = match primitive_name {
        "rotate" => InputPrimitive::Rotate {
            delta: payload_json["delta"].as_f64().unwrap_or(0.0),
        },
        "press" => InputPrimitive::Press,
        "release" => InputPrimitive::Release,
        "long_press" => InputPrimitive::LongPress,
        "swipe_up" => InputPrimitive::Swipe {
            direction: weave_engine::Direction::Up,
        },
        "swipe_down" => InputPrimitive::Swipe {
            direction: weave_engine::Direction::Down,
        },
        "swipe_left" => InputPrimitive::Swipe {
            direction: weave_engine::Direction::Left,
        },
        "swipe_right" => InputPrimitive::Swipe {
            direction: weave_engine::Direction::Right,
        },
        "slide" => InputPrimitive::Slide {
            value: payload_json["value"].as_f64().unwrap_or(0.0),
        },
        "hover" => InputPrimitive::Hover {
            proximity: payload_json["proximity"].as_f64().unwrap_or(0.0),
        },
        "touch_top" => InputPrimitive::Touch {
            area: weave_engine::TouchArea::Top,
        },
        "touch_bottom" => InputPrimitive::Touch {
            area: weave_engine::TouchArea::Bottom,
        },
        "touch_left" => InputPrimitive::Touch {
            area: weave_engine::TouchArea::Left,
        },
        "touch_right" => InputPrimitive::Touch {
            area: weave_engine::TouchArea::Right,
        },
        "key_press" => InputPrimitive::KeyPress {
            key: payload_json["key"].as_u64().unwrap_or(0) as u32,
        },
        _ => return None,
    };

    Some(DeviceEvent {
        device_type,
        device_id,
        input,
    })
}

/// Publish a routed intent to the service command topic.
async fn publish_intent(client: &AsyncClient, routed: &RoutedIntent) {
    let topic = format!(
        "service/{}/{}/command/{}",
        routed.service_type,
        routed.service_target,
        intent_name(&routed.intent),
    );
    let payload = serde_json::to_string(&routed.intent).unwrap_or_default();
    if let Err(e) = client.publish(&topic, QoS::AtMostOnce, false, payload).await {
        tracing::warn!("Failed to publish intent: {}", e);
    }
}

fn intent_name(intent: &weave_engine::Intent) -> &'static str {
    match intent {
        weave_engine::Intent::Play => "play",
        weave_engine::Intent::Pause => "pause",
        weave_engine::Intent::PlayPause => "playpause",
        weave_engine::Intent::Stop => "stop",
        weave_engine::Intent::Next => "next",
        weave_engine::Intent::Previous => "previous",
        weave_engine::Intent::VolumeChange { .. } => "volume_change",
        weave_engine::Intent::VolumeSet { .. } => "volume_set",
        weave_engine::Intent::Mute => "mute",
        weave_engine::Intent::Unmute => "unmute",
        weave_engine::Intent::SeekRelative { .. } => "seek_relative",
        weave_engine::Intent::SeekAbsolute { .. } => "seek_absolute",
        weave_engine::Intent::BrightnessChange { .. } => "brightness_change",
        weave_engine::Intent::BrightnessSet { .. } => "brightness_set",
        weave_engine::Intent::ColorTemperatureChange { .. } => "color_temperature_change",
        weave_engine::Intent::PowerToggle => "power_toggle",
        weave_engine::Intent::PowerOn => "power_on",
        weave_engine::Intent::PowerOff => "power_off",
        weave_engine::Intent::Custom { name, .. } => {
            // Leak is acceptable here since custom names are few and long-lived
            Box::leak(name.clone().into_boxed_str())
        }
    }
}
