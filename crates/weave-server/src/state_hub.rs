//! In-memory state hub: accumulates edge/service/device state from `/ws/edge`,
//! broadcasts `UiFrame` to `/ws/ui` subscribers, and snapshots on demand for
//! newly-connecting UIs.
//!
//! Kept intentionally simple — all writes take a short lock; fan-out is via a
//! `tokio::sync::broadcast` channel sized for a handful of dashboards.

use std::collections::HashMap;
use std::sync::RwLock;

use chrono::Utc;
use tokio::sync::broadcast;
use weave_contracts::{
    DeviceStateEntry, EdgeInfo, ServiceStateEntry, UiFrame, UiSnapshot,
};

const UI_CHANNEL_CAPACITY: usize = 256;

#[derive(Hash, Eq, PartialEq, Clone)]
struct ServiceKey {
    edge_id: String,
    service_type: String,
    target: String,
    property: String,
    output_id: Option<String>,
}

#[derive(Hash, Eq, PartialEq, Clone)]
struct DeviceKey {
    edge_id: String,
    device_type: String,
    device_id: String,
    property: String,
}

pub struct StateHub {
    inner: RwLock<Inner>,
    tx: broadcast::Sender<UiFrame>,
}

struct Inner {
    edges: HashMap<String, EdgeInfo>,
    service_states: HashMap<ServiceKey, (serde_json::Value, String)>,
    device_states: HashMap<DeviceKey, (serde_json::Value, String)>,
}

impl Default for StateHub {
    fn default() -> Self {
        Self::new()
    }
}

impl StateHub {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(UI_CHANNEL_CAPACITY);
        Self {
            inner: RwLock::new(Inner {
                edges: HashMap::new(),
                service_states: HashMap::new(),
                device_states: HashMap::new(),
            }),
            tx,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<UiFrame> {
        self.tx.subscribe()
    }

    pub fn snapshot(&self) -> UiSnapshot {
        let g = self.inner.read().unwrap();
        let edges = g.edges.values().cloned().collect();
        let service_states = g
            .service_states
            .iter()
            .map(|(k, (v, ts))| ServiceStateEntry {
                edge_id: k.edge_id.clone(),
                service_type: k.service_type.clone(),
                target: k.target.clone(),
                property: k.property.clone(),
                output_id: k.output_id.clone(),
                value: v.clone(),
                updated_at: ts.clone(),
            })
            .collect();
        let device_states = g
            .device_states
            .iter()
            .map(|(k, (v, ts))| DeviceStateEntry {
                edge_id: k.edge_id.clone(),
                device_type: k.device_type.clone(),
                device_id: k.device_id.clone(),
                property: k.property.clone(),
                value: v.clone(),
                updated_at: ts.clone(),
            })
            .collect();
        UiSnapshot {
            edges,
            service_states,
            device_states,
            mappings: Vec::new(),
            glyphs: Vec::new(),
        }
    }

    pub fn mark_online(
        &self,
        edge_id: String,
        version: String,
        capabilities: Vec<String>,
    ) {
        let info = EdgeInfo {
            edge_id: edge_id.clone(),
            online: true,
            version,
            capabilities,
            last_seen: Utc::now().to_rfc3339(),
        };
        {
            let mut g = self.inner.write().unwrap();
            g.edges.insert(edge_id, info.clone());
        }
        let _ = self.tx.send(UiFrame::EdgeOnline { edge: info });
    }

    pub fn mark_offline(&self, edge_id: &str) {
        {
            let mut g = self.inner.write().unwrap();
            if let Some(info) = g.edges.get_mut(edge_id) {
                info.online = false;
                info.last_seen = Utc::now().to_rfc3339();
            }
        }
        let _ = self.tx.send(UiFrame::EdgeOffline {
            edge_id: edge_id.to_string(),
        });
    }

    pub fn record_service_state(
        &self,
        edge_id: &str,
        service_type: &str,
        target: &str,
        property: &str,
        output_id: Option<String>,
        value: serde_json::Value,
    ) {
        let ts = Utc::now().to_rfc3339();
        let key = ServiceKey {
            edge_id: edge_id.to_string(),
            service_type: service_type.to_string(),
            target: target.to_string(),
            property: property.to_string(),
            output_id: output_id.clone(),
        };
        {
            let mut g = self.inner.write().unwrap();
            g.service_states.insert(key, (value.clone(), ts.clone()));
        }
        let _ = self.tx.send(UiFrame::ServiceState {
            edge_id: edge_id.to_string(),
            service_type: service_type.to_string(),
            target: target.to_string(),
            property: property.to_string(),
            output_id,
            value,
        });
    }

    pub fn record_device_state(
        &self,
        edge_id: &str,
        device_type: &str,
        device_id: &str,
        property: &str,
        value: serde_json::Value,
    ) {
        let ts = Utc::now().to_rfc3339();
        let key = DeviceKey {
            edge_id: edge_id.to_string(),
            device_type: device_type.to_string(),
            device_id: device_id.to_string(),
            property: property.to_string(),
        };
        {
            let mut g = self.inner.write().unwrap();
            g.device_states.insert(key, (value.clone(), ts));
        }
        let _ = self.tx.send(UiFrame::DeviceState {
            edge_id: edge_id.to_string(),
            device_type: device_type.to_string(),
            device_id: device_id.to_string(),
            property: property.to_string(),
            value,
        });
    }

    /// Fan-out frame emitted by non-state sources (mapping/glyph CRUD).
    pub fn broadcast(&self, frame: UiFrame) {
        let _ = self.tx.send(frame);
    }
}
