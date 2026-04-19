//! Shared application context. Wraps the long-lived Arcs that every router
//! and WebSocket handler needs access to.

use std::sync::Arc;

use rumqttc::AsyncClient;
use weave_engine::RoutingEngine;

use crate::push_broker::PushBroker;
use crate::sqlite_store::SqliteStore;
use crate::state_hub::StateHub;

#[derive(Clone)]
pub struct AppCtx {
    pub engine: Arc<RoutingEngine>,
    pub store: Arc<SqliteStore>,
    pub hub: Arc<StateHub>,
    pub broker: Arc<PushBroker>,
    /// MQTT client for the cross-host path (None when
    /// `WEAVE_DISABLE_MQTT=1`). Used to fan out glyph changes to
    /// `system/glyphs/{name}` so MQTT consumers (nuimo-mqtt etc.) stay
    /// in sync.
    pub mqtt: Option<AsyncClient>,
}
