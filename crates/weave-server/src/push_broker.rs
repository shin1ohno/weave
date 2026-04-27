//! Server→Edge push broker: keeps one mpsc sender per connected edge and
//! lets other parts of the server (REST mutations, startup flows) push
//! `ServerToEdge` frames to a specific edge or to every edge.

use std::collections::HashMap;
use std::sync::Mutex;

use tokio::sync::mpsc;
use weave_contracts::ServerToEdge;

#[derive(Default)]
pub struct PushBroker {
    senders: Mutex<HashMap<String, mpsc::Sender<ServerToEdge>>>,
}

impl PushBroker {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, edge_id: String, tx: mpsc::Sender<ServerToEdge>) {
        self.senders.lock().unwrap().insert(edge_id, tx);
    }

    pub fn unregister(&self, edge_id: &str) {
        self.senders.lock().unwrap().remove(edge_id);
    }

    /// Send `frame` only to `edge_id`. Returns false if the edge is not
    /// currently connected.
    pub fn send_to_edge(&self, edge_id: &str, frame: ServerToEdge) -> bool {
        let sender = {
            let g = self.senders.lock().unwrap();
            g.get(edge_id).cloned()
        };
        match sender {
            Some(tx) => tx.try_send(frame).is_ok(),
            None => false,
        }
    }

    /// Send `frame` to every connected edge. Returns the number of edges
    /// that received the frame.
    pub fn broadcast(&self, frame: ServerToEdge) -> usize {
        let senders: Vec<_> = {
            let g = self.senders.lock().unwrap();
            g.values().cloned().collect()
        };
        let mut delivered = 0;
        for tx in &senders {
            if tx.try_send(frame.clone()).is_ok() {
                delivered += 1;
            }
        }
        delivered
    }

    /// Send `frame` to every connected edge except the one named in
    /// `except_edge_id`. Returns the number of edges that received the
    /// frame. Used for cross-edge fan-out (e.g. forwarding service_state
    /// from the publisher edge to its peers).
    pub fn broadcast_except(&self, except_edge_id: &str, frame: ServerToEdge) -> usize {
        let senders: Vec<_> = {
            let g = self.senders.lock().unwrap();
            g.iter()
                .filter(|(eid, _)| eid.as_str() != except_edge_id)
                .map(|(_, tx)| tx.clone())
                .collect()
        };
        let mut delivered = 0;
        for tx in &senders {
            if tx.try_send(frame.clone()).is_ok() {
                delivered += 1;
            }
        }
        delivered
    }

    #[allow(dead_code)]
    pub fn connected_edges(&self) -> Vec<String> {
        self.senders.lock().unwrap().keys().cloned().collect()
    }
}
