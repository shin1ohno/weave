//! `/ws/ui` WebSocket handler for the Web UI.
//!
//! On upgrade, send a full `UiSnapshot` (including mappings + glyphs from the
//! store), then forward every `UiFrame` broadcast by `state_hub` until the
//! client disconnects.

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use weave_contracts::Mapping as ContractMapping;
use weave_engine::MappingStore;

use crate::ctx::AppCtx;
use crate::web_view::{WebFrame, WebSnapshot};

pub async fn handler(ws: WebSocketUpgrade, State(ctx): State<AppCtx>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, ctx))
}

async fn handle_socket(socket: WebSocket, ctx: AppCtx) {
    let (mut tx, mut rx) = socket.split();

    let mut snapshot = ctx.hub.snapshot();

    if let Ok(mappings) = ctx.store.list_mappings().await {
        snapshot.mappings = mappings
            .iter()
            .filter_map(|m| {
                serde_json::to_value(m)
                    .and_then(serde_json::from_value::<ContractMapping>)
                    .ok()
            })
            .collect();
    }
    snapshot.glyphs = ctx.store.list_glyphs().await.unwrap_or_default();

    let first = WebFrame::Snapshot {
        snapshot: WebSnapshot::build_with_metrics(snapshot, &ctx.hub),
    };
    if let Ok(json) = serde_json::to_string(&first) {
        if tx.send(Message::Text(json)).await.is_err() {
            return;
        }
    }

    let mut updates = ctx.hub.subscribe();
    loop {
        tokio::select! {
            incoming = rx.next() => {
                match incoming {
                    None | Some(Err(_)) => return,
                    Some(Ok(Message::Close(_))) => return,
                    Some(Ok(_)) => continue,
                }
            }
            ev = updates.recv() => {
                match ev {
                    Ok(frame) => {
                        let view = WebFrame::from(frame);
                        let Ok(json) = serde_json::to_string(&view) else { continue; };
                        if tx.send(Message::Text(json)).await.is_err() {
                            return;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => return,
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                        tracing::warn!(skipped = n, "ui ws broadcast lag; resyncing");
                        let mut snap = ctx.hub.snapshot();
                        if let Ok(mappings) = ctx.store.list_mappings().await {
                            snap.mappings = mappings
                                .iter()
                                .filter_map(|m| {
                                    serde_json::to_value(m)
                                        .and_then(serde_json::from_value::<ContractMapping>)
                                        .ok()
                                })
                                .collect();
                        }
                        snap.glyphs = ctx.store.list_glyphs().await.unwrap_or_default();
                        let frame = WebFrame::Snapshot {
                            snapshot: WebSnapshot::build_with_metrics(snap, &ctx.hub),
                        };
                        if let Ok(json) = serde_json::to_string(&frame) {
                            if tx.send(Message::Text(json)).await.is_err() {
                                return;
                            }
                        }
                    }
                }
            }
        }
    }
}
