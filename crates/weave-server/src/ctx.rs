//! Shared application context. Wraps the long-lived Arcs that every router
//! and WebSocket handler needs access to.

use std::sync::Arc;

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
}
