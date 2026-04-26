//! Reusable Template bundles for the Connection editor.
//!
//! A `Template` bundles a set of `routes` and `feedback` rules with display
//! metadata. Built-in templates (Playback / Light / Single button / Start
//! blank) ship with the server and are read-only; user-created templates are
//! persisted in SQLite and editable.
//!
//! The Connection editor in the Web UI applies a template to populate a
//! mapping's `routes` + `feedback` fields without forcing the user to author
//! them from primitives.

use serde::{Deserialize, Serialize};

use crate::intents::IntentType;
use crate::mapping::FeedbackRule;
use crate::primitives::InputType;
use crate::route::{Route, RouteParams};

/// A reusable bundle of routes + feedback rules with display metadata.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Template {
    /// Slug for builtin (`playback`, `light`, …) or uuid for user templates.
    pub id: String,
    pub label: String,
    pub description: String,
    /// Glyph name shown next to the template label (play / bulb / press / plus).
    pub icon: String,
    pub builtin: bool,
    /// Coarse classification: "playback" | "light" | "generic". The Connection
    /// editor uses this to surface relevant templates first.
    pub domain: String,
    pub routes: Vec<Route>,
    #[serde(default)]
    pub feedback: Vec<FeedbackRule>,
    /// RFC3339 timestamp. Built-ins use a fixed seed timestamp so the on-disk
    /// row is byte-identical across restarts.
    pub created_at: String,
}

/// Fixed creation timestamp for every built-in template. Stable across
/// restarts so `seed_builtins` is idempotent on the timestamp column too.
const BUILTIN_CREATED_AT: &str = "2026-04-26T00:00:00Z";

/// The four read-only seed templates surfaced in the Connection editor.
pub fn builtins() -> Vec<Template> {
    vec![
        Template {
            id: "playback".into(),
            label: "Playback".into(),
            description: "rotate→volume · press→play/pause · swipes→prev/next".into(),
            icon: "play".into(),
            builtin: true,
            domain: "playback".into(),
            routes: vec![
                route(InputType::Rotate, IntentType::VolumeChange, 80.0),
                route(InputType::Press, IntentType::PlayPause, 1.0),
                route(InputType::SwipeRight, IntentType::Next, 1.0),
                route(InputType::SwipeLeft, IntentType::Previous, 1.0),
            ],
            feedback: vec![],
            created_at: BUILTIN_CREATED_AT.into(),
        },
        Template {
            id: "light".into(),
            label: "Light".into(),
            description: "press→toggle · slide→brightness".into(),
            icon: "bulb".into(),
            builtin: true,
            domain: "light".into(),
            routes: vec![
                route(InputType::Press, IntentType::PowerToggle, 1.0),
                route(InputType::Slide, IntentType::BrightnessChange, 1.0),
            ],
            feedback: vec![],
            created_at: BUILTIN_CREATED_AT.into(),
        },
        Template {
            id: "single".into(),
            label: "Single button".into(),
            description: "press→one action".into(),
            icon: "press".into(),
            builtin: true,
            domain: "generic".into(),
            routes: vec![route(InputType::Press, IntentType::PlayPause, 1.0)],
            feedback: vec![],
            created_at: BUILTIN_CREATED_AT.into(),
        },
        Template {
            id: "blank".into(),
            label: "Start blank".into(),
            description: "no rules".into(),
            icon: "plus".into(),
            builtin: true,
            domain: "generic".into(),
            routes: vec![],
            feedback: vec![],
            created_at: BUILTIN_CREATED_AT.into(),
        },
    ]
}

fn route(input: InputType, intent: IntentType, damping: f64) -> Route {
    Route {
        input,
        intent,
        params: RouteParams { damping },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtins_have_expected_ids() {
        let ids: Vec<_> = builtins().into_iter().map(|t| t.id).collect();
        assert_eq!(ids, vec!["playback", "light", "single", "blank"]);
    }

    #[test]
    fn playback_has_four_routes() {
        let t = builtins().into_iter().find(|t| t.id == "playback").unwrap();
        assert_eq!(t.routes.len(), 4);
        assert_eq!(t.domain, "playback");
        assert!(t.builtin);
    }

    #[test]
    fn blank_has_no_routes() {
        let t = builtins().into_iter().find(|t| t.id == "blank").unwrap();
        assert!(t.routes.is_empty());
        assert_eq!(t.domain, "generic");
    }
}
