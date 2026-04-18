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
}

fn default_true() -> bool {
    true
}

/// A rule for sending feedback from service state to device display.
#[derive(Debug, Clone, Serialize, Deserialize)]
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
        }
    }

    /// Route an input primitive through this mapping's routes.
    /// Returns the first matching intent, or None.
    pub fn route(&self, input: &InputPrimitive) -> Option<Intent> {
        if !self.active {
            return None;
        }
        for route in &self.routes {
            if let Some(intent) = route.apply(input) {
                return Some(intent);
            }
        }
        None
    }
}
