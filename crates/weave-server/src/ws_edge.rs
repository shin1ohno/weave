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
    EdgeConfig, EdgeToServer, Mapping as ContractMapping, ServerToEdge, UiFrame,
};

use crate::ctx::AppCtx;

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

            let frame = ServerToEdge::ConfigFull {
                config: EdgeConfig {
                    edge_id: eid,
                    mappings: contract_mappings,
                    glyphs: glyph_set,
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
    }
    Ok(())
}
