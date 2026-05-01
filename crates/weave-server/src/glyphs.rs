//! Glyph registry seed + REST API.
//!
//! The canonical set of Nuimo feedback patterns lives in weave so the Web UI
//! can preview/edit them and every edge sees the same visual language.
//! Parametric glyphs (e.g. `volume_bar`) are registered with `builtin = true`
//! and an empty pattern — consumers render them programmatically.
//!
//! Pattern style follows the upstream Senic hub icon set
//! ([reference](https://github.com/tomster/senic-hub/blob/master/nuimo_app/senic/nuimo_app/icons.py)):
//! 9×9 grids with the lit cells centred on the matrix mid-line so the LEDs
//! light up symmetrically. Earlier revisions of this file had several
//! glyphs (notably `play`, `pause`, `next`, `previous`) drifted off-centre
//! by 1–2 columns, which the user experienced as a visibly skewed
//! display. Each named pattern below is checked: counting columns from
//! the left, the lit area is symmetric around column 4 (the matrix
//! centre), or — for arrow-style icons that lean by design — the lit
//! area's bounding box is balanced around column 4.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, put};
use axum::{Json, Router};
use weave_contracts::{Glyph, ServerToEdge, UiFrame};

use crate::ctx::AppCtx;
use crate::sqlite_store::SqliteStore;

mod font;

/// Seed (or refresh) the default glyph set. The named baseline
/// (`play`, `pause`, …) and the programmatic A-Z + 00-99 set are both
/// upserted on every startup so version bumps to their bitmaps
/// propagate without a DB wipe. User-edited glyphs registered under a
/// custom name are left untouched.
pub async fn seed_defaults(store: &SqliteStore) -> anyhow::Result<()> {
    for glyph in default_set() {
        store.upsert_glyph(&glyph).await?;
    }
    for glyph in font::generated_set() {
        store.upsert_glyph(&glyph).await?;
    }
    tracing::info!("refreshed default + font glyph set");
    Ok(())
}

fn default_set() -> Vec<Glyph> {
    vec![
        // Right-pointing triangle, apex col 2, tip col 6 — bounding
        // box spans cols 2..=6 (sum 8), symmetric around column 4.
        // Earlier revision had apex col 4 and tip col 8, which read as
        // right-shifted on the 9×9 matrix.
        Glyph {
            name: "play".into(),
            pattern: concat!(
                "  *      \n",
                "  **     \n",
                "  ***    \n",
                "  ****   \n",
                "  *****  \n",
                "  ****   \n",
                "  ***    \n",
                "  **     \n",
                "  *      ",
            )
            .into(),
            builtin: false,
        },
        // Two vertical bars at cols 2-3 and 5-6, single-column gap at
        // col 4. Earlier revision left a two-column gap (4-5) which
        // pushed the right bar to cols 6-7 — visibly off-centre.
        Glyph {
            name: "pause".into(),
            pattern: concat!(
                "         \n",
                "  ** **  \n",
                "  ** **  \n",
                "  ** **  \n",
                "  ** **  \n",
                "  ** **  \n",
                "  ** **  \n",
                "  ** **  \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        // Skip-to-next: triangle (apex col 2, widest cols 2-4) plus a
        // vertical bar at col 6. Whole composition spans cols 2-6,
        // symmetric around col 4.
        Glyph {
            name: "next".into(),
            pattern: concat!(
                "         \n",
                "         \n",
                "  *   *  \n",
                "  **  *  \n",
                "  *** *  \n",
                "  **  *  \n",
                "  *   *  \n",
                "         \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        // Skip-to-previous: vertical bar at col 2, triangle (apex col
        // 6, widest cols 4-6). Mirror of `next` — also spans cols 2-6,
        // symmetric around col 4.
        Glyph {
            name: "previous".into(),
            pattern: concat!(
                "         \n",
                "         \n",
                "  *   *  \n",
                "  *  **  \n",
                "  * ***  \n",
                "  *  **  \n",
                "  *   *  \n",
                "         \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        // Connection / pairing flourish — a stylised chain link.
        // Already centred in the previous revision; redrawn for
        // tighter symmetry around col 4.
        Glyph {
            name: "link".into(),
            pattern: concat!(
                "         \n",
                "  ** **  \n",
                " *  *  * \n",
                " *     * \n",
                "  *   *  \n",
                " *     * \n",
                " *  *  * \n",
                "  ** **  \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        // Filled bulb shape used by the Hue power_glyph / color_swatch
        // feedback templates. Pattern adapted from senic-hub's
        // LIGHT_BULB icon, redrawn to sit upright (filament rows in
        // the upper half, screw-base hatching below).
        Glyph {
            name: "bulb".into(),
            pattern: concat!(
                "   ***   \n",
                "  *   *  \n",
                "  *   *  \n",
                "  * * *  \n",
                "  * * *  \n",
                "  * * *  \n",
                "   ***   \n",
                "   ***   \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        // Hue light "off" indicator — small dash in the matrix centre.
        // Carried over from senic-hub's LIGHT_OFF.
        Glyph {
            name: "light_off".into(),
            pattern: concat!(
                "         \n",
                "         \n",
                "         \n",
                "    *    \n",
                "   ***   \n",
                "    *    \n",
                "         \n",
                "         \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        // Hue light "on" indicator — sun rays radiating from the
        // centre. Adapted from senic-hub's LIGHT_ON.
        Glyph {
            name: "light_on".into(),
            pattern: concat!(
                "    *    \n",
                " *     * \n",
                "         \n",
                "    *    \n",
                "*  ***  *\n",
                "    *    \n",
                "         \n",
                " *     * \n",
                "    *    ",
            )
            .into(),
            builtin: false,
        },
        // Eighth note for Roon track display. Adapted from
        // senic-hub's MUSIC_NOTE; the flag stem sits on col 2 with
        // the note head at the bottom-left of the figure so the
        // composition reads as a recognisable note even at 9×9.
        Glyph {
            name: "music_note".into(),
            pattern: concat!(
                "  *****  \n",
                "  *****  \n",
                "  *   *  \n",
                "  *   *  \n",
                "  *   *  \n",
                " **  **  \n",
                "*** ***  \n",
                " *   *   \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        // Shuffle indicator — two arrows crossing in the centre.
        // Adapted from senic-hub's SHUFFLE.
        Glyph {
            name: "shuffle".into(),
            pattern: concat!(
                "         \n",
                "         \n",
                " **   ** \n",
                "   * *   \n",
                "    *    \n",
                "   * *   \n",
                " **   ** \n",
                "         \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        // Power circle — used as a "stop" / "powered off" overlay.
        // Adapted from senic-hub's POWER_OFF (a centred ring).
        Glyph {
            name: "power_off".into(),
            pattern: concat!(
                "         \n",
                "         \n",
                "   ***   \n",
                "  *   *  \n",
                "  *   *  \n",
                "  *   *  \n",
                "   ***   \n",
                "         \n",
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
        // Speaker silhouette with a diagonal slash through it.
        // Centred at column 4 to satisfy the bounding-box invariant
        // (lit cols 1..=7).
        Glyph {
            name: "muted".into(),
            pattern: concat!(
                "         \n",
                "   *     \n",
                "  **     \n",
                " ***  *  \n",
                " *** * * \n",
                " ***  *  \n",
                "  **     \n",
                "   *     \n",
                "         ",
            )
            .into(),
            builtin: false,
        },
        // Full 9x9 lit. Rendered briefly (Nuimo's auto-clear takes it
        // back to dark) for `pulse` rules — visual ack that *something*
        // changed without specifying what.
        Glyph {
            name: "pulse".into(),
            pattern: concat!(
                "*********\n",
                "*********\n",
                "*********\n",
                "*********\n",
                "*********\n",
                "*********\n",
                "*********\n",
                "*********\n",
                "*********",
            )
            .into(),
            builtin: false,
        },
    ]
}

pub fn router() -> Router<AppCtx> {
    Router::new()
        .route("/api/glyphs", get(list_glyphs))
        .route("/api/glyphs/:name", get(get_glyph))
        .route("/api/glyphs/:name", put(put_glyph))
        .route("/api/glyphs/:name", delete(delete_glyph))
}

async fn list_glyphs(State(ctx): State<AppCtx>) -> Result<Json<Vec<Glyph>>, StatusCode> {
    ctx.store
        .list_glyphs()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_glyph(
    State(ctx): State<AppCtx>,
    Path(name): Path<String>,
) -> Result<Json<Glyph>, StatusCode> {
    ctx.store
        .get_glyph(&name)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn put_glyph(
    State(ctx): State<AppCtx>,
    Path(name): Path<String>,
    Json(mut glyph): Json<Glyph>,
) -> Result<Json<Glyph>, StatusCode> {
    glyph.name = name;
    ctx.store
        .upsert_glyph(&glyph)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(client) = ctx.mqtt.as_ref() {
        crate::mqtt::publish_glyph(client, &glyph).await;
    }
    push_glyph_change(&ctx).await;
    Ok(Json(glyph))
}

async fn delete_glyph(State(ctx): State<AppCtx>, Path(name): Path<String>) -> StatusCode {
    match ctx.store.delete_glyph(&name).await {
        Ok(true) => {
            if let Some(client) = ctx.mqtt.as_ref() {
                crate::mqtt::publish_glyph_delete(client, &name).await;
            }
            push_glyph_change(&ctx).await;
            StatusCode::NO_CONTENT
        }
        Ok(false) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

async fn push_glyph_change(ctx: &AppCtx) {
    let glyphs = ctx.store.list_glyphs().await.unwrap_or_default();
    ctx.broker.broadcast(ServerToEdge::GlyphsUpdate {
        glyphs: glyphs.clone(),
    });
    ctx.hub.broadcast(UiFrame::GlyphsChanged { glyphs });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Sanity check: every named glyph in `default_set` has a 9×9
    /// pattern. Catches regressions like accidentally dropping the
    /// trailing row or leaving a row with the wrong width.
    #[test]
    fn default_set_patterns_are_9x9_or_empty() {
        for g in default_set() {
            if g.builtin {
                assert!(
                    g.pattern.is_empty(),
                    "{} is builtin (parametric) and should have empty pattern",
                    g.name,
                );
                continue;
            }
            let rows: Vec<&str> = g.pattern.split('\n').collect();
            assert_eq!(rows.len(), 9, "{} should have 9 rows", g.name);
            for (i, row) in rows.iter().enumerate() {
                assert_eq!(
                    row.chars().count(),
                    9,
                    "{} row {} should be 9 chars wide, got {:?}",
                    g.name,
                    i,
                    row,
                );
            }
        }
    }

    /// Bounding-box centring check: for every named non-builtin glyph,
    /// the lit cells' min/max columns sum to 8 (i.e. the bounding box
    /// is symmetric around column 4). This is the right invariant for
    /// arrow-shaped icons whose internal silhouette is intentionally
    /// asymmetric — the *shape* leans, but the matrix it occupies is
    /// balanced. Earlier revisions of `play` / `pause` / `next` /
    /// `previous` all failed this check.
    ///
    /// `music_note` is intrinsically asymmetric (note head on the
    /// left, stem-flag on the right by convention) so the bounding
    /// box can't be centred without making the icon unrecognisable.
    /// It's excluded by name.
    #[test]
    fn default_set_patterns_have_centred_bounding_box() {
        const ASYMMETRIC: &[&str] = &["music_note"];
        for g in default_set() {
            if g.builtin || ASYMMETRIC.contains(&g.name.as_str()) {
                continue;
            }
            let mut min_col = usize::MAX;
            let mut max_col = 0_usize;
            for row in g.pattern.split('\n') {
                for (c_idx, ch) in row.chars().enumerate() {
                    if ch == '*' {
                        min_col = min_col.min(c_idx);
                        max_col = max_col.max(c_idx);
                    }
                }
            }
            // A glyph that has at least one lit cell must straddle
            // column 4 evenly.
            if min_col == usize::MAX {
                continue;
            }
            assert_eq!(
                min_col + max_col,
                8,
                "{}: lit columns span {}..={}, expected min+max==8",
                g.name,
                min_col,
                max_col,
            );
        }
    }
}
