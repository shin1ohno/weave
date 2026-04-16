use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};

use weave_engine::{Mapping, MappingStore, RoutingEngine};

pub struct AppState<S: MappingStore> {
    pub engine: Arc<RoutingEngine>,
    pub store: Arc<S>,
}

pub fn router<S: MappingStore>(state: Arc<AppState<S>>) -> Router {
    Router::new()
        .route("/api/mappings", get(list_mappings::<S>))
        .route("/api/mappings", post(create_mapping::<S>))
        .route("/api/mappings/{id}", get(get_mapping::<S>))
        .route("/api/mappings/{id}", put(update_mapping::<S>))
        .route("/api/mappings/{id}", delete(delete_mapping::<S>))
        .route("/api/mappings/{id}/target", post(switch_target::<S>))
        .with_state(state)
}

async fn list_mappings<S: MappingStore>(
    State(state): State<Arc<AppState<S>>>,
) -> Result<Json<Vec<Mapping>>, StatusCode> {
    let mappings = state.store.list_mappings().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(mappings))
}

async fn get_mapping<S: MappingStore>(
    State(state): State<Arc<AppState<S>>>,
    Path(id): Path<String>,
) -> Result<Json<Mapping>, StatusCode> {
    let uuid: uuid::Uuid = id.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
    let mapping = state
        .store
        .get_mapping(&uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(mapping))
}

async fn create_mapping<S: MappingStore>(
    State(state): State<Arc<AppState<S>>>,
    Json(mapping): Json<Mapping>,
) -> Result<(StatusCode, Json<Mapping>), StatusCode> {
    state
        .store
        .create_mapping(&mapping)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state.engine.upsert_mapping(mapping.clone()).await;
    Ok((StatusCode::CREATED, Json(mapping)))
}

async fn update_mapping<S: MappingStore>(
    State(state): State<Arc<AppState<S>>>,
    Path(id): Path<String>,
    Json(mut mapping): Json<Mapping>,
) -> Result<Json<Mapping>, StatusCode> {
    let uuid: uuid::Uuid = id.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
    mapping.mapping_id = uuid;
    state
        .store
        .update_mapping(&mapping)
        .await
        .map_err(|e| match e {
            weave_engine::StoreError::NotFound(_) => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })?;
    state.engine.upsert_mapping(mapping.clone()).await;
    Ok(Json(mapping))
}

async fn delete_mapping<S: MappingStore>(
    State(state): State<Arc<AppState<S>>>,
    Path(id): Path<String>,
) -> StatusCode {
    let uuid: uuid::Uuid = match id.parse() {
        Ok(u) => u,
        Err(_) => return StatusCode::BAD_REQUEST,
    };
    match state.store.delete_mapping(&uuid).await {
        Ok(true) => {
            state.engine.remove_mapping(uuid).await;
            StatusCode::NO_CONTENT
        }
        Ok(false) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

#[derive(serde::Deserialize)]
struct SwitchTargetRequest {
    service_target: String,
}

async fn switch_target<S: MappingStore>(
    State(state): State<Arc<AppState<S>>>,
    Path(id): Path<String>,
    Json(body): Json<SwitchTargetRequest>,
) -> StatusCode {
    let uuid: uuid::Uuid = match id.parse() {
        Ok(u) => u,
        Err(_) => return StatusCode::BAD_REQUEST,
    };
    if state.engine.switch_target(uuid, &body.service_target).await {
        // Also update store
        if let Ok(Some(mut mapping)) = state.store.get_mapping(&uuid).await {
            mapping.service_target = body.service_target;
            let _ = state.store.update_mapping(&mapping).await;
        }
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}
