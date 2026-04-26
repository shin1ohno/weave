use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::intents::Intent;
use crate::primitives::InputPrimitive;
use crate::route::Route;

/// A complete device → service mapping configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mapping {
    pub mapping_id: Uuid,
    #[serde(default)]
    pub edge_id: String,
    pub device_type: String,
    pub device_id: String,
    pub service_type: String,
    pub service_target: String,
    pub routes: Vec<Route>,
    #[serde(default)]
    pub feedback: Vec<FeedbackRule>,
    #[serde(default = "default_true")]
    pub active: bool,
    #[serde(default)]
    pub target_candidates: Vec<TargetCandidate>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_switch_on: Option<String>,
}

fn default_true() -> bool {
    true
}

/// Pre-configured destination the edge can switch to in selection mode.
/// Shape mirrors `weave_contracts::TargetCandidate` so the JSON round-trip
/// between the wire format and the engine's internal type preserves every
/// field, including the cross-service overrides.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetCandidate {
    pub target: String,
    #[serde(default)]
    pub label: String,
    pub glyph: String,
    /// Override the mapping's `service_type` when this candidate is active.
    /// `None` = inherit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub service_type: Option<String>,
    /// Override the mapping's `routes` when this candidate is active. In
    /// practice mandatory when `service_type` differs (intents are
    /// service-specific). `None` = inherit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub routes: Option<Vec<Route>>,
}

/// A rule for sending feedback from service state to device display.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FeedbackRule {
    /// Service state property to watch (e.g., "playback", "volume").
    pub state: String,
    /// Feedback type to send to device (e.g., "glyph").
    pub feedback_type: String,
    /// Mapping of state values to feedback values.
    pub mapping: serde_json::Value,
}

impl Mapping {
    /// Create a new mapping with a generated ID.
    pub fn new(
        device_type: &str,
        device_id: &str,
        service_type: &str,
        service_target: &str,
        routes: Vec<Route>,
    ) -> Self {
        Self {
            mapping_id: Uuid::new_v4(),
            edge_id: String::new(),
            device_type: device_type.to_string(),
            device_id: device_id.to_string(),
            service_type: service_type.to_string(),
            service_target: service_target.to_string(),
            routes,
            feedback: Vec::new(),
            active: true,
            target_candidates: Vec::new(),
            target_switch_on: None,
        }
    }

    /// Route an input primitive through this mapping's routes.
    /// Returns the first matching intent, or None.
    ///
    /// Uses `effective_for(service_target)` so the currently active
    /// cross-service candidate's route table wins over the mapping's
    /// defaults.
    pub fn route(&self, input: &InputPrimitive) -> Option<Intent> {
        if !self.active {
            return None;
        }
        let (_, routes) = self.effective_for(&self.service_target);
        for route in routes {
            if let Some(intent) = route.apply(input) {
                return Some(intent);
            }
        }
        None
    }

    /// Resolve the effective `(service_type, routes)` for a given active
    /// target. If a `target_candidates` entry matches and has overrides,
    /// those win; otherwise the mapping's own fields are returned. Callers
    /// on the routing hot path should pass the mapping's active
    /// `service_target` to get the right adapter + intent table for the
    /// next emitted intent.
    pub fn effective_for<'a>(&'a self, target: &str) -> (&'a str, &'a [Route]) {
        let candidate = self.target_candidates.iter().find(|c| c.target == target);
        let service_type = candidate
            .and_then(|c| c.service_type.as_deref())
            .unwrap_or(self.service_type.as_str());
        let routes = candidate
            .and_then(|c| c.routes.as_deref())
            .unwrap_or(self.routes.as_slice());
        (service_type, routes)
    }
}
