mod api;
mod mqtt;
mod sqlite_store;
mod ws_edge;

use std::sync::Arc;

use axum::routing::get;
use axum::Router;
use tower_http::cors::CorsLayer;
use weave_engine::{MappingStore, RoutingEngine};

use crate::sqlite_store::SqliteStore;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("WEAVE_DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://weave.db?mode=rwc".into());
    let mqtt_host = std::env::var("MQTT_HOST").unwrap_or_else(|_| "localhost".into());
    let mqtt_port: u16 = std::env::var("MQTT_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(1883);
    let api_port: u16 = std::env::var("API_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);

    let store = Arc::new(SqliteStore::connect(&database_url).await?);
    tracing::info!(database_url = %database_url, "sqlite store ready");

    let engine = Arc::new(RoutingEngine::new());
    let mappings = store.list_mappings().await?;
    engine.load_mappings(mappings).await;

    // MQTT bridge is kept for Phase 1 back-compat but is non-fatal: if the
    // broker is unreachable, log and continue so weave-server can still serve
    // REST + WS clients. Removed in Phase 4.
    let mqtt_bridge = mqtt::MqttBridge::new(&mqtt_host, mqtt_port);
    match mqtt_bridge.start(engine.clone()).await {
        Ok(_) => tracing::info!(%mqtt_host, mqtt_port, "MQTT bridge started"),
        Err(e) => tracing::warn!(
            error = %e,
            "MQTT bridge failed to start; continuing without it (Phase 4 removes MQTT entirely)"
        ),
    }

    let app_state = Arc::new(api::AppState {
        engine: engine.clone(),
        store: store.clone(),
    });
    let api_router = api::router(app_state);
    let ws_router = Router::new()
        .route("/ws/edge", get(ws_edge::handler))
        .with_state(store);

    let app = api_router.merge(ws_router).layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", api_port)).await?;
    tracing::info!(api_port, "HTTP + WS listening");

    axum::serve(listener, app).await?;

    Ok(())
}
