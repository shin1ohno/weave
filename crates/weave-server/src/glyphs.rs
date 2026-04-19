//! Glyph registry seed + REST API.
//!
//! The canonical set of Nuimo feedback patterns lives in weave so the Web UI
//! can preview/edit them and every edge sees the same visual language.
//! Parametric glyphs (e.g. `volume_bar`) are registered with `builtin = true`
//! and an empty pattern — consumers render them programmatically.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, put};
use axum::{Json, Router};
use weave_contracts::Glyph;

use crate::sqlite_store::SqliteStore;

/// Seed the default glyph set when the table is empty. Safe to call on every
/// startup — becomes a no-op once at least one row exists.
pub async fn seed_defaults(store: &SqliteStore) -> anyhow::Result<()> {
    let n = store.glyph_count().await?;
    if n > 0 {
        return Ok(());
    }
    for glyph in default_set() {
        store.upsert_glyph(&glyph).await?;
    }
    tracing::info!("seeded default glyph set");
    Ok(())
}

fn default_set() -> Vec<Glyph> {
    vec![
        Glyph {
            name: "play".into(),
            pattern: concat!(
                "    *    \n",
                "    **   \n",
                "    ***  \n",
                "    **** \n",
                "    *****\n",
                "    **** \n",
                "    ***  \n",
                "    **   \n",
                "    *    ",
            )
            .into(),
            builtin: false,
        },
        Glyph {
            name: "pause".into(),
            pattern: concat!(
                "  **  ** \n",
                "  **  ** \n",
                "  **  ** \n",
                "  **  ** \n",
                "  **  ** \n",
                "  **  ** \n",
                "  **  ** \n",
                "  **  ** \n",
                "  **  ** ",
            )
            .into(),
            builtin: false,
        },
        Glyph {
            name: "next".into(),
            pattern: concat!(
                "  *   *  \n",
                "  **  ** \n",
                "  *** ***\n",
                "  ********\n",
                "  ********\n",
                "  ********\n",
                "  *** ***\n",
                "  **  ** \n",
                "  *   *  ",
            )
            .into(),
            builtin: false,
        },
        Glyph {
            name: "previous".into(),
            pattern: concat!(
                "  *   *  \n",
                " **  **  \n",
                "*** *** \n",
                "********\n",
                "********\n",
                "********\n",
                "*** *** \n",
                " **  **  \n",
                "  *   *  ",
            )
            .into(),
            builtin: false,
        },
        Glyph {
            name: "link".into(),
            pattern: concat!(
                "         \n",
                "  ** **  \n",
                " *  * *  \n",
                " *    *  \n",
                "  *  *   \n",
                " *    *  \n",
                " * *  *  \n",
                "  ** **  \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        Glyph {
            name: "volume_bar".into(),
            pattern: String::new(),
            builtin: true,
        },
    ]
}

pub fn router(store: Arc<SqliteStore>) -> Router {
    Router::new()
        .route("/api/glyphs", get(list_glyphs))
        .route("/api/glyphs/{name}", get(get_glyph))
        .route("/api/glyphs/{name}", put(put_glyph))
        .route("/api/glyphs/{name}", delete(delete_glyph))
        .with_state(store)
}

async fn list_glyphs(
    State(store): State<Arc<SqliteStore>>,
) -> Result<Json<Vec<Glyph>>, StatusCode> {
    store
        .list_glyphs()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_glyph(
    State(store): State<Arc<SqliteStore>>,
    Path(name): Path<String>,
) -> Result<Json<Glyph>, StatusCode> {
    store
        .get_glyph(&name)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn put_glyph(
    State(store): State<Arc<SqliteStore>>,
    Path(name): Path<String>,
    Json(mut glyph): Json<Glyph>,
) -> Result<Json<Glyph>, StatusCode> {
    glyph.name = name;
    store
        .upsert_glyph(&glyph)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(glyph))
}

async fn delete_glyph(
    State(store): State<Arc<SqliteStore>>,
    Path(name): Path<String>,
) -> StatusCode {
    match store.delete_glyph(&name).await {
        Ok(true) => StatusCode::NO_CONTENT,
        Ok(false) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
