//! REST API for mapping CRUD. Every mutation also pushes the appropriate
//! `ServerToEdge` frame to the affected edge via `push_broker` and a
//! `UiFrame::MappingChanged` to `/ws/ui` subscribers via `state_hub`.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use weave_contracts::{
    DeviceCycle as ContractDeviceCycle, Mapping as ContractMapping, PatchOp, ServerToEdge, UiFrame,
};
use weave_engine::mapping::{DeviceCycle, TargetCandidate};
use weave_engine::{FeedbackRule, Mapping, MappingStore, Route};

use crate::ctx::AppCtx;

pub fn router() -> Router<AppCtx> {
    Router::new()
        .route("/api/mappings", get(list_mappings))
        .route("/api/mappings", post(create_mapping))
        .route("/api/mappings/:id", get(get_mapping))
        .route("/api/mappings/:id", put(update_mapping))
        .route("/api/mappings/:id", delete(delete_mapping))
        .route("/api/mappings/:id/target", post(switch_target))
        .route(
            "/api/devices/:device_type/:device_id/cycle",
            get(get_cycle).put(put_cycle).delete(delete_cycle),
        )
        .route(
            "/api/devices/:device_type/:device_id/cycle/switch",
            post(switch_cycle_active),
        )
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

/// Wire payload for `POST /api/mappings`. Mirrors `Mapping` minus
/// `mapping_id` — the server allocates the UUID so clients (browsers in
/// non-secure contexts where `crypto.randomUUID` is undefined, lightweight
/// scripts, etc.) don't need to.
#[derive(serde::Deserialize)]
struct CreateMappingRequest {
    #[serde(default)]
    edge_id: String,
    device_type: String,
    device_id: String,
    service_type: String,
    service_target: String,
    routes: Vec<Route>,
    #[serde(default)]
    feedback: Vec<FeedbackRule>,
    #[serde(default = "default_true")]
    active: bool,
    #[serde(default)]
    target_candidates: Vec<TargetCandidate>,
    #[serde(default)]
    target_switch_on: Option<String>,
}

fn default_true() -> bool {
    true
}

async fn create_mapping(
    State(ctx): State<AppCtx>,
    Json(req): Json<CreateMappingRequest>,
) -> Result<(StatusCode, Json<Mapping>), StatusCode> {
    let mapping = Mapping {
        mapping_id: uuid::Uuid::new_v4(),
        edge_id: req.edge_id,
        device_type: req.device_type,
        device_id: req.device_id,
        service_type: req.service_type,
        service_target: req.service_target,
        routes: req.routes,
        feedback: req.feedback,
        active: req.active,
        target_candidates: req.target_candidates,
        target_switch_on: req.target_switch_on,
    };
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

// --- Device cycle CRUD -------------------------------------------------

fn cycle_to_contract(c: &DeviceCycle) -> ContractDeviceCycle {
    ContractDeviceCycle {
        device_type: c.device_type.clone(),
        device_id: c.device_id.clone(),
        mapping_ids: c.mapping_ids.clone(),
        active_mapping_id: c.active_mapping_id,
        cycle_gesture: c.cycle_gesture.clone(),
    }
}

async fn get_cycle(
    State(ctx): State<AppCtx>,
    Path((device_type, device_id)): Path<(String, String)>,
) -> Result<Json<DeviceCycle>, StatusCode> {
    let cycle = ctx
        .store
        .get_cycle(&device_type, &device_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(cycle))
}

#[derive(serde::Deserialize)]
struct PutCycleBody {
    mapping_ids: Vec<uuid::Uuid>,
    #[serde(default)]
    active_mapping_id: Option<uuid::Uuid>,
    #[serde(default)]
    cycle_gesture: Option<String>,
}

async fn put_cycle(
    State(ctx): State<AppCtx>,
    Path((device_type, device_id)): Path<(String, String)>,
    Json(body): Json<PutCycleBody>,
) -> Result<Json<DeviceCycle>, StatusCode> {
    if body.mapping_ids.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let active = body
        .active_mapping_id
        .filter(|id| body.mapping_ids.contains(id))
        .or_else(|| body.mapping_ids.first().copied());
    let cycle = DeviceCycle {
        device_type: device_type.clone(),
        device_id: device_id.clone(),
        mapping_ids: body.mapping_ids,
        active_mapping_id: active,
        cycle_gesture: body.cycle_gesture,
    };
    ctx.store
        .upsert_cycle(&cycle)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    ctx.engine.upsert_cycle(cycle.clone()).await;
    push_cycle_change(&ctx, &cycle, PatchOp::Upsert).await;
    Ok(Json(cycle))
}

async fn delete_cycle(
    State(ctx): State<AppCtx>,
    Path((device_type, device_id)): Path<(String, String)>,
) -> StatusCode {
    let existed = match ctx.store.delete_cycle(&device_type, &device_id).await {
        Ok(b) => b,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR,
    };
    if !existed {
        return StatusCode::NOT_FOUND;
    }
    ctx.engine.remove_cycle(&device_type, &device_id).await;
    let placeholder = DeviceCycle {
        device_type: device_type.clone(),
        device_id: device_id.clone(),
        mapping_ids: Vec::new(),
        active_mapping_id: None,
        cycle_gesture: None,
    };
    push_cycle_change(&ctx, &placeholder, PatchOp::Delete).await;
    StatusCode::NO_CONTENT
}

#[derive(serde::Deserialize)]
struct SwitchCycleActiveBody {
    active_mapping_id: uuid::Uuid,
}

async fn switch_cycle_active(
    State(ctx): State<AppCtx>,
    Path((device_type, device_id)): Path<(String, String)>,
    Json(body): Json<SwitchCycleActiveBody>,
) -> StatusCode {
    if apply_cycle_switch_active(&ctx, &device_type, &device_id, body.active_mapping_id).await {
        StatusCode::OK
    } else {
        StatusCode::NOT_FOUND
    }
}

/// Shared cycle-switch path: invoked by REST `POST .../cycle/switch` and
/// by WS `EdgeToServer::SwitchActiveConnection`. Returns true on success.
pub async fn apply_cycle_switch_active(
    ctx: &AppCtx,
    device_type: &str,
    device_id: &str,
    active_mapping_id: uuid::Uuid,
) -> bool {
    if !ctx
        .engine
        .set_active(device_type, device_id, active_mapping_id)
        .await
    {
        return false;
    }
    let Ok(persisted) = ctx
        .store
        .set_cycle_active(device_type, device_id, active_mapping_id)
        .await
    else {
        return false;
    };
    if !persisted {
        return false;
    }
    let Ok(Some(cycle)) = ctx.store.get_cycle(device_type, device_id).await else {
        return false;
    };
    push_cycle_change(ctx, &cycle, PatchOp::Upsert).await;
    push_cycle_active_to_edges(ctx, device_type, device_id, active_mapping_id).await;
    true
}

async fn push_cycle_change(ctx: &AppCtx, cycle: &DeviceCycle, op: PatchOp) {
    let contract = cycle_to_contract(cycle);
    let frame_cycle = if matches!(op, PatchOp::Delete) {
        None
    } else {
        Some(contract.clone())
    };
    ctx.hub.broadcast(UiFrame::DeviceCycleChanged {
        device_type: cycle.device_type.clone(),
        device_id: cycle.device_id.clone(),
        op,
        cycle: frame_cycle,
    });
    let edges = edges_for_device(ctx, &cycle.device_type, &cycle.device_id).await;
    for edge_id in edges {
        ctx.broker.send_to_edge(
            &edge_id,
            ServerToEdge::DeviceCyclePatch {
                cycle: contract.clone(),
                op,
            },
        );
    }
}

async fn push_cycle_active_to_edges(
    ctx: &AppCtx,
    device_type: &str,
    device_id: &str,
    active_mapping_id: uuid::Uuid,
) {
    let edges = edges_for_device(ctx, device_type, device_id).await;
    for edge_id in edges {
        ctx.broker.send_to_edge(
            &edge_id,
            ServerToEdge::SwitchActiveConnection {
                device_type: device_type.to_string(),
                device_id: device_id.to_string(),
                active_mapping_id,
            },
        );
    }
}

/// Edge IDs that own at least one mapping referencing this device.
async fn edges_for_device(
    ctx: &AppCtx,
    device_type: &str,
    device_id: &str,
) -> std::collections::HashSet<String> {
    ctx.engine
        .list_mappings()
        .await
        .into_iter()
        .filter(|m| m.device_type == device_type && m.device_id == device_id)
        .map(|m| m.edge_id)
        .filter(|e| !e.is_empty())
        .collect()
}
