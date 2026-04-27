//! `/ws/ui`-only view types that wrap the canonical `weave-contracts` UI
//! shapes with additional fields the UI wants to surface (wifi signal,
//! round-trip latency, derived `connected` flag).
//!
//! These fields are emitted as `null`/`false` until edge-agent ships them
//! through a `weave-contracts` schema bump. Wrapping here keeps the
//! UI-visible JSON shape stable now while sidestepping a multi-repo
//! dependency dance.
//!
//! Internally the server still routes `UiFrame` everywhere; the only
//! conversion point is `ws_ui.rs` where a frame is about to be serialized
//! and shipped to a dashboard.
//!
//! `#[serde(flatten)]` means an `EdgeInfo` round-trips through `WebEdge`
//! without any field renaming — UI code can use the same `edge_id` /
//! `online` / `last_seen` keys as before plus the new ones.

use serde::Serialize;
use uuid::Uuid;
use weave_contracts::{
    CommandResult, DeviceCycle, DeviceStateEntry, EdgeInfo, ErrorSeverity, Glyph, Mapping, PatchOp,
    ServiceStateEntry, UiFrame, UiSnapshot,
};

use crate::state_hub::{EdgeMetrics, StateHub};

#[derive(Debug, Clone, Serialize)]
pub struct WebEdge {
    #[serde(flatten)]
    pub info: EdgeInfo,
    pub wifi: Option<u8>,
    pub latency_ms: Option<u32>,
    pub connected: bool,
}

impl From<EdgeInfo> for WebEdge {
    fn from(info: EdgeInfo) -> Self {
        let connected = info.online;
        Self {
            info,
            wifi: None,
            latency_ms: None,
            connected,
        }
    }
}

impl WebEdge {
    /// Construct a `WebEdge` whose extension fields reflect the latest
    /// known metrics for this edge. Used at snapshot time so newly
    /// connected dashboard clients see current values without waiting
    /// for the next periodic update.
    pub fn with_metrics(info: EdgeInfo, metrics: EdgeMetrics) -> Self {
        let connected = info.online;
        Self {
            info,
            wifi: metrics.wifi,
            latency_ms: metrics.latency_ms,
            connected,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct WebSnapshot {
    pub edges: Vec<WebEdge>,
    pub service_states: Vec<ServiceStateEntry>,
    pub device_states: Vec<DeviceStateEntry>,
    pub mappings: Vec<Mapping>,
    pub glyphs: Vec<Glyph>,
    pub device_cycles: Vec<DeviceCycle>,
}

impl From<UiSnapshot> for WebSnapshot {
    fn from(s: UiSnapshot) -> Self {
        Self {
            edges: s.edges.into_iter().map(WebEdge::from).collect(),
            service_states: s.service_states,
            device_states: s.device_states,
            mappings: s.mappings,
            glyphs: s.glyphs,
            device_cycles: s.device_cycles,
        }
    }
}

impl WebSnapshot {
    /// Build a `WebSnapshot` whose `edges` carry the latest known
    /// metrics from `hub`. Use this for initial-connect and
    /// lag-recovery snapshots so a dashboard sees current wifi /
    /// latency immediately rather than `null` until the next periodic
    /// update.
    pub fn build_with_metrics(s: UiSnapshot, hub: &StateHub) -> Self {
        let edges = s
            .edges
            .into_iter()
            .map(|info| {
                let metrics = hub.metrics(&info.edge_id);
                WebEdge::with_metrics(info, metrics)
            })
            .collect();
        Self {
            edges,
            service_states: s.service_states,
            device_states: s.device_states,
            mappings: s.mappings,
            glyphs: s.glyphs,
            device_cycles: s.device_cycles,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WebFrame {
    Snapshot {
        snapshot: WebSnapshot,
    },
    EdgeOnline {
        edge: WebEdge,
    },
    EdgeOffline {
        edge_id: String,
    },
    ServiceState {
        edge_id: String,
        service_type: String,
        target: String,
        property: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_id: Option<String>,
        value: serde_json::Value,
    },
    DeviceState {
        edge_id: String,
        device_type: String,
        device_id: String,
        property: String,
        value: serde_json::Value,
    },
    MappingChanged {
        mapping_id: Uuid,
        op: PatchOp,
        mapping: Option<Mapping>,
    },
    GlyphsChanged {
        glyphs: Vec<Glyph>,
    },
    Command {
        edge_id: String,
        service_type: String,
        target: String,
        intent: String,
        #[serde(default)]
        params: serde_json::Value,
        result: CommandResult,
        #[serde(skip_serializing_if = "Option::is_none")]
        latency_ms: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        output_id: Option<String>,
        at: String,
    },
    Error {
        edge_id: String,
        context: String,
        message: String,
        severity: ErrorSeverity,
        at: String,
    },
    EdgeStatus {
        edge_id: String,
        wifi: Option<u8>,
        latency_ms: Option<u32>,
    },
    DeviceCycleChanged {
        device_type: String,
        device_id: String,
        op: PatchOp,
        cycle: Option<DeviceCycle>,
    },
}

impl From<UiFrame> for WebFrame {
    fn from(f: UiFrame) -> Self {
        match f {
            UiFrame::Snapshot { snapshot } => WebFrame::Snapshot {
                snapshot: snapshot.into(),
            },
            UiFrame::EdgeOnline { edge } => WebFrame::EdgeOnline { edge: edge.into() },
            UiFrame::EdgeOffline { edge_id } => WebFrame::EdgeOffline { edge_id },
            UiFrame::ServiceState {
                edge_id,
                service_type,
                target,
                property,
                output_id,
                value,
            } => WebFrame::ServiceState {
                edge_id,
                service_type,
                target,
                property,
                output_id,
                value,
            },
            UiFrame::DeviceState {
                edge_id,
                device_type,
                device_id,
                property,
                value,
            } => WebFrame::DeviceState {
                edge_id,
                device_type,
                device_id,
                property,
                value,
            },
            UiFrame::MappingChanged {
                mapping_id,
                op,
                mapping,
            } => WebFrame::MappingChanged {
                mapping_id,
                op,
                mapping,
            },
            UiFrame::GlyphsChanged { glyphs } => WebFrame::GlyphsChanged { glyphs },
            UiFrame::Command {
                edge_id,
                service_type,
                target,
                intent,
                params,
                result,
                latency_ms,
                output_id,
                at,
            } => WebFrame::Command {
                edge_id,
                service_type,
                target,
                intent,
                params,
                result,
                latency_ms,
                output_id,
                at,
            },
            UiFrame::Error {
                edge_id,
                context,
                message,
                severity,
                at,
            } => WebFrame::Error {
                edge_id,
                context,
                message,
                severity,
                at,
            },
            UiFrame::EdgeStatus {
                edge_id,
                wifi,
                latency_ms,
            } => WebFrame::EdgeStatus {
                edge_id,
                wifi,
                latency_ms,
            },
            UiFrame::DeviceCycleChanged {
                device_type,
                device_id,
                op,
                cycle,
            } => WebFrame::DeviceCycleChanged {
                device_type,
                device_id,
                op,
                cycle,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn web_edge_serializes_with_extension_fields() {
        let info = EdgeInfo {
            edge_id: "air".into(),
            online: true,
            version: "0.1.0".into(),
            capabilities: vec!["nuimo".into()],
            last_seen: "2026-04-26T10:00:00Z".into(),
        };
        let view = WebEdge::from(info);
        let json = serde_json::to_value(&view).unwrap();
        assert_eq!(json["edge_id"], "air");
        assert_eq!(json["online"], true);
        assert_eq!(json["wifi"], serde_json::Value::Null);
        assert_eq!(json["latency_ms"], serde_json::Value::Null);
        assert_eq!(json["connected"], true);
    }

    #[test]
    fn web_edge_offline_derives_connected_false() {
        let info = EdgeInfo {
            edge_id: "air".into(),
            online: false,
            version: "0.1.0".into(),
            capabilities: vec![],
            last_seen: "2026-04-26T10:00:00Z".into(),
        };
        assert!(!WebEdge::from(info).connected);
    }
}
