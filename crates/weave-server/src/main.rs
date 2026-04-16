mod api;
mod mqtt;

use std::sync::Arc;

use tower_http::cors::CorsLayer;
use weave_engine::{MappingStore, MemoryStore, RoutingEngine};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let mqtt_host = std::env::var("MQTT_HOST").unwrap_or_else(|_| "localhost".into());
    let mqtt_port: u16 = std::env::var("MQTT_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(1883);
    let api_port: u16 = std::env::var("API_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);

    let engine = Arc::new(RoutingEngine::new());
    let store = Arc::new(MemoryStore::new());

    // Load existing mappings from store
    let mappings = store.list_mappings().await?;
    engine.load_mappings(mappings).await;

    // Start MQTT bridge
    let mqtt_bridge = mqtt::MqttBridge::new(&mqtt_host, mqtt_port);
    let _mqtt_client = mqtt_bridge.start(engine.clone()).await?;
    tracing::info!("MQTT connected to {}:{}", mqtt_host, mqtt_port);

    // Start REST API
    let app_state = Arc::new(api::AppState {
        engine: engine.clone(),
        store,
    });
    let app = api::router(app_state).layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", api_port)).await?;
    tracing::info!("REST API listening on port {}", api_port);

    axum::serve(listener, app).await?;

    Ok(())
}
