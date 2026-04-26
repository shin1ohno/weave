//! REST API for ad-hoc device-control commands. Each handler decodes
//! `(edge_id, device_type, device_id)` from the URL, builds the
//! appropriate `ServerToEdge` frame, and pushes it to the named edge via
//! `PushBroker::send_to_edge`.
//!
//! Unlike mapping CRUD, these endpoints do not persist anything and do not
//! broadcast over `/ws/ui` — they're transient device commands ("connect
//! this Nuimo now", "show test glyph A on this device"). The HTTP response
//! reports only whether the frame was queued for delivery to the edge:
//!
//! - `202 Accepted` when the edge is connected and the frame was queued.
//!   The edge applies the command asynchronously; we do not wait for an ack.
//! - `404 Not Found` when no edge with the given `edge_id` is currently
//!   connected to this server.
//!
//! Path-parameter parse errors fall through to axum's default `400 Bad
//! Request` handling.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::post;
use axum::Router;
use weave_contracts::ServerToEdge;

use crate::ctx::AppCtx;

/// Hardcoded 9x9 ASCII glyph for the `Test LED` button. Renders as a
/// capital "A" so the user can visually confirm the edge → Nuimo path.
/// Pattern format matches `weave_contracts::Glyph::pattern`: 9 lines × 9
/// chars per line, `*` = LED on, anything else = off.
const TEST_GLYPH_A: &str = "\
.........\n\
...***...\n\
..*...*..\n\
..*...*..\n\
..*****..\n\
..*...*..\n\
..*...*..\n\
..*...*..\n\
.........";

pub fn router() -> Router<AppCtx> {
    Router::new()
        .route(
            "/api/devices/:edge_id/:device_type/:device_id/connect",
            post(connect_device),
        )
        .route(
            "/api/devices/:edge_id/:device_type/:device_id/disconnect",
            post(disconnect_device),
        )
        .route(
            "/api/devices/:edge_id/:device_type/:device_id/test-glyph",
            post(test_glyph_device),
        )
}

async fn connect_device(
    State(ctx): State<AppCtx>,
    Path((edge_id, device_type, device_id)): Path<(String, String, String)>,
) -> StatusCode {
    let frame = ServerToEdge::DeviceConnect {
        device_type,
        device_id,
    };
    if ctx.broker.send_to_edge(&edge_id, frame) {
        StatusCode::ACCEPTED
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn disconnect_device(
    State(ctx): State<AppCtx>,
    Path((edge_id, device_type, device_id)): Path<(String, String, String)>,
) -> StatusCode {
    let frame = ServerToEdge::DeviceDisconnect {
        device_type,
        device_id,
    };
    if ctx.broker.send_to_edge(&edge_id, frame) {
        StatusCode::ACCEPTED
    } else {
        StatusCode::NOT_FOUND
    }
}

async fn test_glyph_device(
    State(ctx): State<AppCtx>,
    Path((edge_id, device_type, device_id)): Path<(String, String, String)>,
) -> StatusCode {
    let frame = ServerToEdge::DisplayGlyph {
        device_type,
        device_id,
        pattern: TEST_GLYPH_A.into(),
        brightness: Some(1.0),
        timeout_ms: Some(2000),
        transition: Some("cross_fade".into()),
    };
    if ctx.broker.send_to_edge(&edge_id, frame) {
        StatusCode::ACCEPTED
    } else {
        StatusCode::NOT_FOUND
    }
}
