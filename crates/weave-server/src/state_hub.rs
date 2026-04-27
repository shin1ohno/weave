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
use weave_contracts::{DeviceStateEntry, EdgeInfo, ServiceStateEntry, UiFrame, UiSnapshot};

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

/// Latest known wifi / latency for one edge. Populated by
/// `record_wifi` (edge-reported) and `record_latency`
/// (server-measured Ping/Pong RTT). Both fields are `None` until the
/// corresponding source emits its first value.
#[derive(Debug, Clone, Default)]
pub struct EdgeMetrics {
    pub wifi: Option<u8>,
    pub latency_ms: Option<u32>,
}

pub struct StateHub {
    inner: RwLock<Inner>,
    tx: broadcast::Sender<UiFrame>,
}

struct Inner {
    edges: HashMap<String, EdgeInfo>,
    service_states: HashMap<ServiceKey, (serde_json::Value, String)>,
    device_states: HashMap<DeviceKey, (serde_json::Value, String)>,
    edge_metrics: HashMap<String, EdgeMetrics>,
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
                edge_metrics: HashMap::new(),
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
            device_cycles: Vec::new(),
        }
    }

    pub fn mark_online(&self, edge_id: String, version: String, capabilities: Vec<String>) {
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

    /// Edge IDs whose reported version is ≥ `min_version`. Used by the
    /// service_state fan-out to skip edges running pre-0.13 binaries
    /// that would treat the new `ServerToEdge::ServiceState` variant as
    /// an invalid frame and tear down their WS connection (per the
    /// `edge_core::ws_client` parse-error path that returns from the
    /// loop).
    ///
    /// `min_version` is parsed as semver (`major.minor.patch`); failed
    /// parses default to `(0,0,0)` so unknown versions never qualify.
    pub fn edges_at_least(&self, min_version: (u32, u32, u32)) -> Vec<String> {
        let g = self.inner.read().unwrap();
        g.edges
            .values()
            .filter(|e| {
                e.online
                    && parse_semver(&e.version)
                        .map(|v| v >= min_version)
                        .unwrap_or(false)
            })
            .map(|e| e.edge_id.clone())
            .collect()
    }

    /// Read the current metrics for one edge. Returns the default
    /// (`None` for both fields) when nothing has been recorded yet.
    pub fn metrics(&self, edge_id: &str) -> EdgeMetrics {
        let g = self.inner.read().unwrap();
        g.edge_metrics.get(edge_id).cloned().unwrap_or_default()
    }

    /// Find an online edge whose Hello capabilities include
    /// `service_type`. Selection is deterministic — prefer the highest
    /// reported edge-agent version (older edges may lack the receive-
    /// side handler for `ServerToEdge::DispatchIntent` and silently
    /// drop forwarded intents during a rolling upgrade), then break
    /// ties alphabetically by `edge_id`.
    ///
    /// Used by `EdgeToServer::DispatchIntent` forwarding: when an edge
    /// routes an input but lacks the adapter for the resulting
    /// `service_type`, the server picks a peer edge with the right
    /// capability and emits a `ServerToEdge::DispatchIntent`. Returns
    /// `None` when no online edge advertises the capability — the
    /// caller fans out a `Command{Err}` frame so the live console
    /// surfaces the miss.
    pub fn find_edge_for_service(&self, service_type: &str) -> Option<String> {
        let g = self.inner.read().unwrap();
        let mut candidates: Vec<&weave_contracts::EdgeInfo> = g
            .edges
            .values()
            .filter(|info| info.online && info.capabilities.iter().any(|c| c == service_type))
            .collect();
        // Highest version first, then alphabetical edge_id as tiebreak.
        candidates.sort_by(|a, b| {
            b.version
                .cmp(&a.version)
                .then_with(|| a.edge_id.cmp(&b.edge_id))
        });
        candidates.first().map(|info| info.edge_id.clone())
    }

    /// Record an edge-reported wifi reading. Returns the updated
    /// metrics so callers can fan-out the merged shape.
    pub fn record_wifi(&self, edge_id: &str, wifi: Option<u8>) -> EdgeMetrics {
        let mut g = self.inner.write().unwrap();
        let entry = g.edge_metrics.entry(edge_id.to_string()).or_default();
        entry.wifi = wifi;
        entry.clone()
    }

    /// Record a server-measured Ping/Pong RTT. Returns the updated
    /// metrics so callers can fan-out the merged shape.
    pub fn record_latency(&self, edge_id: &str, latency_ms: u32) -> EdgeMetrics {
        let mut g = self.inner.write().unwrap();
        let entry = g.edge_metrics.entry(edge_id.to_string()).or_default();
        entry.latency_ms = Some(latency_ms);
        entry.clone()
    }

    /// Drop the metrics row for an edge (called on disconnect so a
    /// reconnecting edge starts with a clean slate rather than stale
    /// last-seen values).
    pub fn clear_metrics(&self, edge_id: &str) {
        let mut g = self.inner.write().unwrap();
        g.edge_metrics.remove(edge_id);
    }
}

fn parse_semver(s: &str) -> Option<(u32, u32, u32)> {
    let mut it = s.split('.');
    let major = it.next()?.parse().ok()?;
    let minor = it.next()?.parse().ok()?;
    let patch = it.next()?.split('-').next()?.parse().ok()?;
    Some((major, minor, patch))
}
