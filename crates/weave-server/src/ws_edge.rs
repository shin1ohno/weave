//! `/ws/edge` WebSocket handler.
//!
//! An edge-agent connects, sends a `Hello` frame to declare its `edge_id`,
//! and receives a `ConfigFull` frame with every mapping assigned to it.
//! State frames from the edge are logged; fan-out to the Web UI will be
//! added in Phase 3 via `state_hub`.

use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};

use weave_contracts::{EdgeConfig, EdgeToServer, Mapping as ContractMapping, ServerToEdge};

use crate::sqlite_store::SqliteStore;

pub async fn handler(
    ws: WebSocketUpgrade,
    State(store): State<Arc<SqliteStore>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, store))
}

async fn handle_socket(socket: WebSocket, store: Arc<SqliteStore>) {
    let (mut tx, mut rx) = socket.split();
    let mut edge_id: Option<String> = None;

    while let Some(Ok(msg)) = rx.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => {
                tracing::debug!(?edge_id, "edge closed ws");
                return;
            }
            _ => continue,
        };

        let parsed = match serde_json::from_str::<EdgeToServer>(&text) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(?edge_id, error = %e, payload = %text, "invalid edge frame");
                continue;
            }
        };

        match parsed {
            EdgeToServer::Hello {
                edge_id: eid,
                version,
                capabilities,
            } => {
                tracing::info!(%eid, %version, ?capabilities, "edge connected");
                edge_id = Some(eid.clone());

                let mappings = match store.list_by_edge(&eid).await {
                    Ok(v) => v,
                    Err(e) => {
                        tracing::error!(edge_id = %eid, error = %e, "failed to load mappings");
                        continue;
                    }
                };

                let contract_mappings: Vec<ContractMapping> = mappings
                    .iter()
                    .filter_map(|m| match serde_json::to_value(m).and_then(serde_json::from_value) {
                        Ok(cm) => Some(cm),
                        Err(e) => {
                            tracing::warn!(
                                mapping_id = %m.mapping_id,
                                error = %e,
                                "failed to convert mapping to contract form; skipping",
                            );
                            None
                        }
                    })
                    .collect();

                let frame = ServerToEdge::ConfigFull {
                    config: EdgeConfig {
                        edge_id: eid,
                        mappings: contract_mappings,
                    },
                };

                let Ok(json) = serde_json::to_string(&frame) else {
                    continue;
                };
                if tx.send(Message::Text(json)).await.is_err() {
                    return;
                }
            }
            EdgeToServer::State {
                service_type,
                target,
                property,
                output_id,
                value,
            } => {
                tracing::debug!(
                    ?edge_id, %service_type, %target, %property, ?output_id, ?value,
                    "edge state (phase 1: logged only, fan-out in phase 3)",
                );
            }
            EdgeToServer::DeviceState {
                device_type,
                device_id,
                property,
                value,
            } => {
                tracing::debug!(
                    ?edge_id, %device_type, %device_id, %property, ?value,
                    "edge device state (phase 1: logged only)",
                );
            }
            EdgeToServer::Pong => {
                tracing::trace!(?edge_id, "pong");
            }
        }
    }

    tracing::debug!(?edge_id, "edge ws ended");
}
