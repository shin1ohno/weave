//! REST API for the reusable template registry.
//!
//! Templates are route + feedback bundles the Connection editor applies to
//! populate a mapping. Built-in seeds (`playback`, `light`, `single`,
//! `blank`) are upserted at startup via `seed_builtins` and refuse mutation
//! through the public API; user-created templates use a UUID id.
//!
//! Mutations don't broadcast over WebSocket — the UI revalidates on the
//! POST/PUT/DELETE response, which is sufficient because templates are only
//! consulted at edit time, not on the routing hot path.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use weave_engine::mapping::FeedbackRule;
use weave_engine::route::Route;
use weave_engine::{Template, TemplateStore};

use crate::ctx::AppCtx;
use crate::sqlite_store::SqliteStore;

pub fn router() -> Router<AppCtx> {
    Router::new()
        .route("/api/templates", get(list_templates))
        .route("/api/templates", post(create_template))
        .route("/api/templates/:id", put(update_template))
        .route("/api/templates/:id", delete(delete_template))
}

/// Idempotently upsert every built-in template. Safe to run on every
/// startup — the upsert key (id) is a stable slug so re-running the migration
/// or restarting the server never duplicates rows.
pub async fn seed_builtins(store: &Arc<SqliteStore>) -> anyhow::Result<()> {
    for t in weave_engine::template::builtins() {
        store.upsert_template(&t).await?;
    }
    tracing::info!("seeded built-in templates");
    Ok(())
}

async fn list_templates(State(ctx): State<AppCtx>) -> Result<Json<Vec<Template>>, StatusCode> {
    ctx.store
        .list_templates()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

/// Wire payload for `POST /api/templates`. The server allocates `id`,
/// `created_at`, and forces `builtin = false` — clients can never create a
/// new built-in over REST.
#[derive(Deserialize)]
struct CreateTemplateBody {
    label: String,
    #[serde(default)]
    description: String,
    #[serde(default = "default_icon")]
    icon: String,
    #[serde(default = "default_domain")]
    domain: String,
    #[serde(default)]
    routes: Vec<Route>,
    #[serde(default)]
    feedback: Vec<FeedbackRule>,
}

fn default_icon() -> String {
    "plus".into()
}

fn default_domain() -> String {
    "generic".into()
}

async fn create_template(
    State(ctx): State<AppCtx>,
    Json(body): Json<CreateTemplateBody>,
) -> Result<(StatusCode, Json<Template>), StatusCode> {
    let template = Template {
        id: uuid::Uuid::new_v4().to_string(),
        label: body.label,
        description: body.description,
        icon: body.icon,
        builtin: false,
        domain: body.domain,
        routes: body.routes,
        feedback: body.feedback,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    ctx.store
        .upsert_template(&template)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok((StatusCode::CREATED, Json(template)))
}

async fn update_template(
    State(ctx): State<AppCtx>,
    Path(id): Path<String>,
    Json(mut template): Json<Template>,
) -> Result<Json<Template>, StatusCode> {
    if template.id != id {
        return Err(StatusCode::BAD_REQUEST);
    }
    // Block edits to built-ins. Read existing row, not the request body —
    // a malicious client could otherwise flip `builtin` to false and then
    // edit the resource.
    match ctx.store.get_template(&id).await {
        Ok(Some(existing)) if existing.builtin => return Err(StatusCode::FORBIDDEN),
        Ok(Some(_)) => {}
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
    // Force `builtin = false` for user templates regardless of payload.
    template.builtin = false;
    ctx.store
        .upsert_template(&template)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(template))
}

async fn delete_template(State(ctx): State<AppCtx>, Path(id): Path<String>) -> StatusCode {
    match ctx.store.get_template(&id).await {
        Ok(Some(existing)) if existing.builtin => return StatusCode::FORBIDDEN,
        Ok(Some(_)) => {}
        Ok(None) => return StatusCode::NOT_FOUND,
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR,
    }
    match ctx.store.delete_template(&id).await {
        Ok(true) => StatusCode::NO_CONTENT,
        Ok(false) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn seed_builtins_is_idempotent() {
        let store = Arc::new(SqliteStore::connect("sqlite::memory:").await.unwrap());
        seed_builtins(&store).await.unwrap();
        seed_builtins(&store).await.unwrap();
        seed_builtins(&store).await.unwrap();

        let listed = store.list_templates().await.unwrap();
        // 4 built-ins: playback, light, single, blank
        assert_eq!(listed.len(), 4);

        // Specifically verify the playback row is unique.
        let playback_count = listed.iter().filter(|t| t.id == "playback").count();
        assert_eq!(playback_count, 1);
    }

    #[tokio::test]
    async fn seed_builtins_round_trips_routes() {
        let store = Arc::new(SqliteStore::connect("sqlite::memory:").await.unwrap());
        seed_builtins(&store).await.unwrap();

        let playback = store.get_template("playback").await.unwrap().unwrap();
        assert_eq!(playback.routes.len(), 4);
        assert_eq!(playback.domain, "playback");
        assert!(playback.builtin);
    }
}
