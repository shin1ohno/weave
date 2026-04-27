mod api;
mod ctx;
mod devices;
mod enforce_single_active;
mod glyphs;
mod migrate_target_candidates;
mod mqtt;
mod push_broker;
mod sqlite_store;
mod state_hub;
mod templates;
mod web_view;
mod ws_edge;
mod ws_ui;

use std::sync::Arc;

use axum::routing::get;
use axum::Router;
use tower_http::cors::CorsLayer;
use weave_engine::{MappingStore, RoutingEngine};

use crate::ctx::AppCtx;
use crate::push_broker::PushBroker;
use crate::sqlite_store::SqliteStore;
use crate::state_hub::StateHub;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let database_url =
        std::env::var("WEAVE_DATABASE_URL").unwrap_or_else(|_| "sqlite://weave.db?mode=rwc".into());
    let mqtt_host = std::env::var("MQTT_HOST").unwrap_or_else(|_| "localhost".into());
    let mqtt_port: u16 = std::env::var("MQTT_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(1883);
    let api_port: u16 = std::env::var("API_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);
    let disable_mqtt = std::env::var("WEAVE_DISABLE_MQTT")
        .map(|v| !matches!(v.as_str(), "" | "0" | "false" | "no"))
        .unwrap_or(false);

    let store = Arc::new(SqliteStore::connect(&database_url).await?);
    tracing::info!(database_url = %database_url, "sqlite store ready");
    glyphs::seed_defaults(&store).await?;
    templates::seed_builtins(&store).await?;

    // Idempotent: expands legacy `target_candidates` / `target_switch_on`
    // into separate Mapping rows + a DeviceCycle row per affected device.
    // Subsequent restarts find nothing to do and return 0.
    let migrated_cycles = migrate_target_candidates::migrate_target_candidates(&store).await?;
    if migrated_cycles > 0 {
        tracing::info!(
            count = migrated_cycles,
            "migrated legacy target_candidates → device_cycles"
        );
    }
    // Single-active-per-device invariant: for every (device_type, device_id)
    // bucket with N>=2 mappings, exactly one carries `mapping.active = true`.
    // Idempotent — re-runs are no-ops once the invariant holds.
    let _ = enforce_single_active::enforce_single_active_invariant(&store).await?;

    let engine = Arc::new(RoutingEngine::new());
    let mappings = store.list_mappings().await?;
    engine.load_mappings(mappings).await;
    let cycles = store.list_cycles().await?;
    engine.load_cycles(cycles).await;

    let hub = Arc::new(StateHub::new());
    let broker = Arc::new(PushBroker::new());

    // MQTT path remains available as the N:N cross-host alternative. Disabled
    // entirely if WEAVE_DISABLE_MQTT is set; otherwise we try to connect and
    // keep serving REST + WS regardless of broker availability. When
    // connected, also hydrate `system/glyphs/{name}` so MQTT consumers
    // (nuimo-mqtt etc.) see the current glyph set.
    let mqtt_client = if disable_mqtt {
        tracing::info!("MQTT bridge disabled via WEAVE_DISABLE_MQTT");
        None
    } else {
        let mqtt_bridge = mqtt::MqttBridge::new(&mqtt_host, mqtt_port);
        match mqtt_bridge.start(engine.clone()).await {
            Ok(client) => {
                tracing::info!(%mqtt_host, mqtt_port, "MQTT bridge started");
                let glyph_set = store.list_glyphs().await.unwrap_or_default();
                for g in &glyph_set {
                    mqtt::publish_glyph(&client, g).await;
                }
                tracing::info!(
                    count = glyph_set.len(),
                    "published glyphs to system/glyphs/*"
                );
                Some(client)
            }
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "MQTT bridge failed to start; continuing without it"
                );
                None
            }
        }
    };

    let ctx = AppCtx {
        engine: engine.clone(),
        store: store.clone(),
        hub: hub.clone(),
        broker: broker.clone(),
        mqtt: mqtt_client,
    };

    let app: Router = Router::new()
        .merge(api::router())
        .merge(devices::router())
        .merge(glyphs::router())
        .merge(templates::router())
        .route("/ws/edge", get(ws_edge::handler))
        .route("/ws/ui", get(ws_ui::handler))
        .with_state(ctx)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", api_port)).await?;
    tracing::info!(api_port, "HTTP + WS listening");

    axum::serve(listener, app).await?;

    Ok(())
}
