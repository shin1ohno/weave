use serde::{Deserialize, Serialize};

/// Service-level intents produced by the routing engine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum Intent {
    // Playback
    Play,
    Pause,
    PlayPause,
    Stop,
    Next,
    Previous,

    // Volume
    VolumeChange {
        delta: f64,
    },
    VolumeSet {
        value: f64,
    },
    Mute,
    Unmute,

    // Seek
    SeekRelative {
        seconds: f64,
    },
    SeekAbsolute {
        seconds: f64,
    },

    // Lighting
    BrightnessChange {
        delta: f64,
    },
    BrightnessSet {
        value: f64,
    },
    ColorTemperatureChange {
        delta: f64,
    },
    PowerToggle,
    PowerOn,
    PowerOff,

    // Generic
    Custom {
        name: String,
        value: serde_json::Value,
    },
}

/// The type of intent (without data), used in route configuration.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntentType {
    Play,
    Pause,
    PlayPause,
    Stop,
    Next,
    Previous,
    VolumeChange,
    VolumeSet,
    Mute,
    Unmute,
    SeekRelative,
    SeekAbsolute,
    BrightnessChange,
    BrightnessSet,
    ColorTemperatureChange,
    PowerToggle,
    PowerOn,
    PowerOff,
    Custom { name: String },
}
