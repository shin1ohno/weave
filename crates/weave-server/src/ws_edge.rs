//! `/ws/edge` WebSocket handler.
//!
//! An edge-agent connects, sends a `Hello` frame with its `edge_id`, and
//! the server pushes the matching `ConfigFull` (mappings + glyphs). The
//! handler then runs bidirectionally: inbound `state` / `device_state`
//! frames feed `state_hub`, and outbound `ServerToEdge` frames (mapping
//! patches, glyph updates) arrive from `push_broker` and get forwarded to
//! the edge.

use std::time::{Duration, Instant};

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;

use weave_contracts::{
    DeviceCycle as ContractDeviceCycle, EdgeConfig, EdgeToServer, Mapping as ContractMapping,
    ServerToEdge, UiFrame,
};
use weave_engine::mapping::DeviceCycle as EngineDeviceCycle;

use crate::ctx::AppCtx;

/// Round-trip the engine's `DeviceCycle` through the contract shape.
/// Field names line up by design; this is a one-shot conversion that
/// `serde_json::to_value` makes explicit.
fn cycle_engine_to_contract(c: EngineDeviceCycle) -> ContractDeviceCycle {
    ContractDeviceCycle {
        device_type: c.device_type,
        device_id: c.device_id,
        mapping_ids: c.mapping_ids,
        active_mapping_id: c.active_mapping_id,
        cycle_gesture: c.cycle_gesture,
    }
}

const OUTBOX_CAPACITY: usize = 128;
/// Cadence at which the server pings each edge to measure ws round-trip
/// latency. Matches the edge-agent's EdgeStatus publish interval so a
/// dashboard sees both metrics refreshed at roughly the same rate.
const PING_INTERVAL: Duration = Duration::from_secs(10);

pub async fn handler(ws: WebSocketUpgrade, State(ctx): State<AppCtx>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, ctx))
}

async fn handle_socket(socket: WebSocket, ctx: AppCtx) {
    let (mut tx, mut rx) = socket.split();
    let (outbox_tx, mut outbox_rx) = mpsc::channel::<ServerToEdge>(OUTBOX_CAPACITY);
    let mut edge_id: Option<String> = None;
    let mut ping_interval = tokio::time::interval(PING_INTERVAL);
    // Skip the immediate first tick so we don't ping before the edge has
    // sent its `Hello`.
    ping_interval.tick().await;
    let mut pending_ping_at: Option<Instant> = None;

    loop {
        tokio::select! {
            incoming = rx.next() => {
                let Some(msg) = incoming else { break; };
                let msg = match msg {
                    Ok(m) => m,
                    Err(e) => {
                        tracing::debug!(error = %e, "edge ws recv error");
                        break;
                    }
                };
                match msg {
                    Message::Text(text) => {
                        if let Err(()) = handle_edge_text(
                            &text,
                            &ctx,
                            &mut edge_id,
                            &outbox_tx,
                            &mut tx,
                            &mut pending_ping_at,
                        )
                        .await
                        {
                            break;
                        }
                    }
                    Message::Close(_) => break,
                    _ => continue,
                }
            }
            outbound = outbox_rx.recv() => {
                let Some(frame) = outbound else { break; };
                let Ok(json) = serde_json::to_string(&frame) else { continue; };
                if tx.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
            _ = ping_interval.tick() => {
                // Only measure RTT once an edge has identified itself; pre-Hello
                // pings would be unattributable. Skip the cycle if a previous
                // Ping is still outstanding (drop the older one — the edge is
                // either slow to respond or the link is half-open and will
                // be torn down on the next read error).
                if edge_id.is_none() {
                    continue;
                }
                let Ok(json) = serde_json::to_string(&ServerToEdge::Ping) else { continue; };
                if tx.send(Message::Text(json)).await.is_err() {
                    break;
                }
                pending_ping_at = Some(Instant::now());
            }
        }
    }

    if let Some(eid) = edge_id {
        ctx.broker.unregister(&eid);
        ctx.hub.mark_offline(&eid);
        ctx.hub.clear_metrics(&eid);
        tracing::debug!(edge_id = %eid, "edge ws ended");
    }
}

async fn handle_edge_text(
    text: &str,
    ctx: &AppCtx,
    edge_id: &mut Option<String>,
    outbox_tx: &mpsc::Sender<ServerToEdge>,
    tx: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    pending_ping_at: &mut Option<Instant>,
) -> Result<(), ()> {
    let parsed = match serde_json::from_str::<EdgeToServer>(text) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(error = %e, payload = %text, "invalid edge frame");
            return Ok(());
        }
    };

    match parsed {
        EdgeToServer::Hello {
            edge_id: eid,
            version,
            capabilities,
        } => {
            tracing::info!(%eid, %version, ?capabilities, "edge connected");
            *edge_id = Some(eid.clone());
            ctx.broker.register(eid.clone(), outbox_tx.clone());
            ctx.hub.mark_online(eid.clone(), version, capabilities);

            let mappings = ctx.store.list_by_edge(&eid).await.unwrap_or_default();
            let contract_mappings: Vec<ContractMapping> = mappings
                .iter()
                .filter_map(
                    |m| match serde_json::to_value(m).and_then(serde_json::from_value) {
                        Ok(cm) => Some(cm),
                        Err(e) => {
                            tracing::warn!(
                                mapping_id = %m.mapping_id,
                                error = %e,
                                "failed to convert mapping to contract form; skipping",
                            );
                            None
                        }
                    },
                )
                .collect();

            let glyph_set = ctx.store.list_glyphs().await.unwrap_or_default();

            // Include only the cycles for devices owned by this edge so
            // the local routing engine can apply active filtering. Device
            // ownership is identified via mapping.edge_id; collect the
            // device keys this edge owns and intersect with the cycle list.
            let owned_devices: std::collections::HashSet<(String, String)> = contract_mappings
                .iter()
                .map(|m| (m.device_type.clone(), m.device_id.clone()))
                .collect();
            let all_cycles = ctx.store.list_cycles().await.unwrap_or_default();
            let edge_cycles: Vec<_> = all_cycles
                .into_iter()
                .filter(|c| owned_devices.contains(&(c.device_type.clone(), c.device_id.clone())))
                .map(cycle_engine_to_contract)
                .collect();

            let frame = ServerToEdge::ConfigFull {
                config: EdgeConfig {
                    edge_id: eid,
                    mappings: contract_mappings,
                    glyphs: glyph_set,
                    device_cycles: edge_cycles,
                },
            };
            let Ok(json) = serde_json::to_string(&frame) else {
                return Ok(());
            };
            if tx.send(Message::Text(json)).await.is_err() {
                return Err(());
            }
        }
        EdgeToServer::State {
            service_type,
            target,
            property,
            output_id,
            value,
        } => {
            if let Some(eid) = edge_id.as_deref() {
                ctx.hub.record_service_state(
                    eid,
                    &service_type,
                    &target,
                    &property,
                    output_id,
                    value,
                );
            }
        }
        EdgeToServer::DeviceState {
            device_type,
            device_id,
            property,
            value,
        } => {
            if let Some(eid) = edge_id.as_deref() {
                ctx.hub
                    .record_device_state(eid, &device_type, &device_id, &property, value);
            }
        }
        EdgeToServer::Pong => {
            tracing::trace!(edge_id = ?edge_id, "pong");
            if let (Some(eid), Some(sent)) = (edge_id.as_deref(), pending_ping_at.take()) {
                let rtt_ms = sent.elapsed().as_millis().min(u128::from(u32::MAX)) as u32;
                let metrics = ctx.hub.record_latency(eid, rtt_ms);
                ctx.hub.broadcast(UiFrame::EdgeStatus {
                    edge_id: eid.to_string(),
                    wifi: metrics.wifi,
                    latency_ms: metrics.latency_ms,
                });
            }
        }
        EdgeToServer::EdgeStatus { wifi } => {
            if let Some(eid) = edge_id.as_deref() {
                let metrics = ctx.hub.record_wifi(eid, wifi);
                ctx.hub.broadcast(UiFrame::EdgeStatus {
                    edge_id: eid.to_string(),
                    wifi: metrics.wifi,
                    latency_ms: metrics.latency_ms,
                });
            }
        }
        EdgeToServer::SwitchTarget {
            mapping_id,
            service_target,
        } => {
            let applied = crate::api::apply_switch_target(ctx, mapping_id, &service_target).await;
            tracing::info!(
                edge_id = ?edge_id,
                ?mapping_id,
                service_target = %service_target,
                applied,
                "edge-driven target switch"
            );
        }
        EdgeToServer::SwitchActiveConnection {
            device_type,
            device_id,
            active_mapping_id,
        } => {
            let applied = crate::api::apply_cycle_switch_active(
                ctx,
                &device_type,
                &device_id,
                active_mapping_id,
            )
            .await;
            tracing::info!(
                edge_id = ?edge_id,
                %device_type,
                %device_id,
                %active_mapping_id,
                applied,
                "edge-driven cycle active switch"
            );
        }
        EdgeToServer::Command {
            service_type,
            target,
            intent,
            params,
            result,
            latency_ms,
            output_id,
        } => {
            if let Some(eid) = edge_id.as_deref() {
                ctx.hub.broadcast(UiFrame::Command {
                    edge_id: eid.to_string(),
                    service_type,
                    target,
                    intent,
                    params,
                    result,
                    latency_ms,
                    output_id,
                    at: chrono::Utc::now().to_rfc3339(),
                });
            }
        }
        EdgeToServer::Error {
            context,
            message,
            severity,
        } => {
            if let Some(eid) = edge_id.as_deref() {
                ctx.hub.broadcast(UiFrame::Error {
                    edge_id: eid.to_string(),
                    context,
                    message,
                    severity,
                    at: chrono::Utc::now().to_rfc3339(),
                });
            }
        }
        EdgeToServer::DispatchIntent {
            service_type,
            service_target,
            intent,
            params,
            output_id,
        } => {
            // Origin edge routed an input but lacks the adapter. Find a
            // connected edge whose Hello capabilities include
            // `service_type` and forward the intent there. The executing
            // edge will emit `EdgeToServer::Command` after dispatch, so
            // the live UI sees the actual outcome and latency.
            //
            // No capable edge → fan out a `Command{Err}` so the live
            // console row still surfaces the miss instead of the press
            // appearing to do nothing.
            if let Some(target_edge) = ctx.hub.find_edge_for_service(&service_type) {
                tracing::info!(
                    source_edge = ?edge_id,
                    %target_edge,
                    %service_type,
                    target = %service_target,
                    %intent,
                    "dispatch_intent: forwarding",
                );
                let frame = ServerToEdge::DispatchIntent {
                    service_type: service_type.clone(),
                    service_target: service_target.clone(),
                    intent: intent.clone(),
                    params: params.clone(),
                    output_id: output_id.clone(),
                };
                if !ctx.broker.send_to_edge(&target_edge, frame) {
                    tracing::warn!(
                        source_edge = ?edge_id,
                        %target_edge,
                        %service_type,
                        "dispatch_intent: target edge has no active sender",
                    );
                }
            } else {
                tracing::warn!(
                    source_edge = ?edge_id,
                    %service_type,
                    target = %service_target,
                    %intent,
                    "dispatch_intent: no online edge advertises capability",
                );
                ctx.hub.broadcast(UiFrame::Command {
                    edge_id: edge_id.clone().unwrap_or_default(),
                    service_type,
                    target: service_target,
                    intent,
                    params,
                    result: weave_contracts::CommandResult::Err {
                        message: "no edge has matching capability".to_string(),
                    },
                    latency_ms: None,
                    output_id,
                    at: chrono::Utc::now().to_rfc3339(),
                });
            }
        }
    }
    Ok(())
}
