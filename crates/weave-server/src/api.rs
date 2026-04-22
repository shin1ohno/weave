//! REST API for mapping CRUD. Every mutation also pushes the appropriate
//! `ServerToEdge` frame to the affected edge via `push_broker` and a
//! `UiFrame::MappingChanged` to `/ws/ui` subscribers via `state_hub`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use weave_contracts::{Mapping as ContractMapping, PatchOp, ServerToEdge, UiFrame};
use weave_engine::{Mapping, MappingStore};

use crate::ctx::AppCtx;

pub fn router() -> Router<AppCtx> {
    Router::new()
        .route("/api/mappings", get(list_mappings))
        .route("/api/mappings", post(create_mapping))
        .route("/api/mappings/:id", get(get_mapping))
        .route("/api/mappings/:id", put(update_mapping))
        .route("/api/mappings/:id", delete(delete_mapping))
        .route("/api/mappings/{id}/target", post(switch_target))
        .route("/api/presets", get(list_presets))
}

// ---------- Presets -------------------------------------------------------
// Read-only starter templates for the Routes editor. Stays server-side so
// multiple clients see the same list, and so future tweaks ship without
// requiring a web-UI redeploy. Kept static for now — user-editable presets
// would need schema + CRUD and are explicitly out of scope.

#[derive(serde::Serialize)]
struct Preset {
    id: &'static str,
    label: &'static str,
    description: &'static str,
    routes: Vec<weave_engine::Route>,
}

async fn list_presets() -> Json<Vec<Preset>> {
    use weave_engine::intents::IntentType;
    use weave_engine::primitives::InputType;
    use weave_engine::route::{Route, RouteParams};

    fn route(input: InputType, intent: IntentType, damping: f64) -> Route {
        Route {
            input,
            intent,
            params: RouteParams { damping },
        }
    }

    Json(vec![
        Preset {
            id: "music_default",
            label: "Music default",
            description: "Rotate → volume, press → play/pause, swipe → next/prev.",
            routes: vec![
                route(InputType::Rotate, IntentType::VolumeChange, 80.0),
                route(InputType::Press, IntentType::PlayPause, 1.0),
                route(InputType::SwipeRight, IntentType::Next, 1.0),
                route(InputType::SwipeLeft, IntentType::Previous, 1.0),
            ],
        },
        Preset {
            id: "discovery",
            label: "Discovery",
            description: "Rotate → brightness, press → toggle power, swipes → explicit on/off.",
            routes: vec![
                route(InputType::Rotate, IntentType::BrightnessChange, 80.0),
                route(InputType::Press, IntentType::PowerToggle, 1.0),
                route(InputType::SwipeUp, IntentType::PowerOn, 1.0),
                route(InputType::SwipeDown, IntentType::PowerOff, 1.0),
            ],
        },
        Preset {
            id: "single_button",
            label: "Single button",
            description: "Just one gesture: press → play/pause. Good for locked targets.",
            routes: vec![route(InputType::Press, IntentType::PlayPause, 1.0)],
        },
        Preset {
            id: "custom",
            label: "Custom",
            description: "Start from scratch — no routes assigned.",
            routes: vec![],
        },
    ])
}

fn to_contract(m: &Mapping) -> Option<ContractMapping> {
    serde_json::to_value(m)
        .and_then(serde_json::from_value)
        .ok()
}

async fn list_mappings(State(ctx): State<AppCtx>) -> Result<Json<Vec<Mapping>>, StatusCode> {
    let mappings = ctx
        .store
        .list_mappings()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(mappings))
}

async fn get_mapping(
    State(ctx): State<AppCtx>,
    Path(id): Path<String>,
) -> Result<Json<Mapping>, StatusCode> {
    let uuid: uuid::Uuid = id.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
    let mapping = ctx
        .store
        .get_mapping(&uuid)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(mapping))
}

async fn create_mapping(
    State(ctx): State<AppCtx>,
    Json(mapping): Json<Mapping>,
) -> Result<(StatusCode, Json<Mapping>), StatusCode> {
    ctx.store
        .create_mapping(&mapping)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    ctx.engine.upsert_mapping(mapping.clone()).await;
    push_mapping_upsert(&ctx, &mapping);
    Ok((StatusCode::CREATED, Json(mapping)))
}

async fn update_mapping(
    State(ctx): State<AppCtx>,
    Path(id): Path<String>,
    Json(mut mapping): Json<Mapping>,
) -> Result<Json<Mapping>, StatusCode> {
    let uuid: uuid::Uuid = id.parse().map_err(|_| StatusCode::BAD_REQUEST)?;
    mapping.mapping_id = uuid;
    ctx.store
        .update_mapping(&mapping)
        .await
        .map_err(|e| match e {
            weave_engine::StoreError::NotFound(_) => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })?;
    ctx.engine.upsert_mapping(mapping.clone()).await;
    push_mapping_upsert(&ctx, &mapping);
    Ok(Json(mapping))
}

async fn delete_mapping(State(ctx): State<AppCtx>, Path(id): Path<String>) -> StatusCode {
    let uuid: uuid::Uuid = match id.parse() {
        Ok(u) => u,
        Err(_) => return StatusCode::BAD_REQUEST,
    };

    let existing = ctx.store.get_mapping(&uuid).await.ok().flatten();

    match ctx.store.delete_mapping(&uuid).await {
        Ok(true) => {
            ctx.engine.remove_mapping(uuid).await;
            if let Some(m) = existing {
                push_mapping_delete(&ctx, &m);
            } else {
                ctx.hub.broadcast(UiFrame::MappingChanged {
                    mapping_id: uuid,
                    op: PatchOp::Delete,
                    mapping: None,
                });
            }
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

async fn switch_target(
    State(ctx): State<AppCtx>,
    Path(id): Path<String>,
    Json(body): Json<SwitchTargetRequest>,
) -> StatusCode {
    let uuid: uuid::Uuid = match id.parse() {
        Ok(u) => u,
        Err(_) => return StatusCode::BAD_REQUEST,
    };
    if apply_switch_target(&ctx, uuid, &body.service_target).await {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

/// Shared target-switch path used by the REST handler (`POST
/// /api/mappings/:id/target`) and the WS edge handler (receipt of
/// `EdgeToServer::SwitchTarget`). Returns true if a mapping with the
/// given id was found and its `service_target` updated; false means
/// "nothing to do" (unknown mapping).
pub async fn apply_switch_target(
    ctx: &AppCtx,
    mapping_id: uuid::Uuid,
    service_target: &str,
) -> bool {
    if !ctx.engine.switch_target(mapping_id, service_target).await {
        return false;
    }
    let Ok(Some(mut mapping)) = ctx.store.get_mapping(&mapping_id).await else {
        return false;
    };
    mapping.service_target = service_target.to_string();
    let _ = ctx.store.update_mapping(&mapping).await;
    push_mapping_upsert(ctx, &mapping);
    true
}

fn push_mapping_upsert(ctx: &AppCtx, mapping: &Mapping) {
    let Some(contract) = to_contract(mapping) else {
        return;
    };
    // Push to the owning edge so it updates its routing engine immediately.
    if !contract.edge_id.is_empty() {
        ctx.broker.send_to_edge(
            &contract.edge_id,
            ServerToEdge::ConfigPatch {
                mapping_id: contract.mapping_id,
                op: PatchOp::Upsert,
                mapping: Some(contract.clone()),
            },
        );
    }
    // Fan out to every connected Web UI.
    ctx.hub.broadcast(UiFrame::MappingChanged {
        mapping_id: contract.mapping_id,
        op: PatchOp::Upsert,
        mapping: Some(contract),
    });
}

fn push_mapping_delete(ctx: &AppCtx, mapping: &Mapping) {
    let mapping_id = mapping.mapping_id;
    if !mapping.edge_id.is_empty() {
        ctx.broker.send_to_edge(
            &mapping.edge_id,
            ServerToEdge::ConfigPatch {
                mapping_id,
                op: PatchOp::Delete,
                mapping: None,
            },
        );
    }
    ctx.hub.broadcast(UiFrame::MappingChanged {
        mapping_id,
        op: PatchOp::Delete,
        mapping: None,
    });
}
