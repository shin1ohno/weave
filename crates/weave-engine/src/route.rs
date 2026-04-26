use serde::{Deserialize, Serialize};

use crate::intents::{Intent, IntentType};
use crate::primitives::{InputPrimitive, InputType};

/// A single routing rule: input type → intent type with optional parameters.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Route {
    pub input: InputType,
    pub intent: IntentType,
    #[serde(default)]
    pub params: RouteParams,
}

/// Parameters that modify how an input is transformed into an intent.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct RouteParams {
    /// Multiplier for continuous values (rotate delta, slide value).
    #[serde(default = "default_damping")]
    pub damping: f64,
}

fn default_damping() -> f64 {
    1.0
}

impl Route {
    /// Apply this route to a concrete input primitive, producing an intent.
    pub fn apply(&self, input: &InputPrimitive) -> Option<Intent> {
        if input.input_type() != self.input {
            return None;
        }

        Some(match (&self.intent, input) {
            // Continuous value intents need the input's delta/value
            (IntentType::VolumeChange, InputPrimitive::Rotate { delta }) => Intent::VolumeChange {
                delta: delta * self.params.damping,
            },
            (IntentType::VolumeChange, InputPrimitive::Slide { value }) => Intent::VolumeChange {
                delta: value * self.params.damping,
            },
            (IntentType::BrightnessChange, InputPrimitive::Rotate { delta }) => {
                Intent::BrightnessChange {
                    delta: delta * self.params.damping,
                }
            }
            (IntentType::SeekRelative, InputPrimitive::Rotate { delta }) => Intent::SeekRelative {
                seconds: delta * self.params.damping,
            },
            (IntentType::ColorTemperatureChange, InputPrimitive::Rotate { delta }) => {
                Intent::ColorTemperatureChange {
                    delta: delta * self.params.damping,
                }
            }

            // Simple 1:1 mappings (no data needed from input)
            (IntentType::Play, _) => Intent::Play,
            (IntentType::Pause, _) => Intent::Pause,
            (IntentType::PlayPause, _) => Intent::PlayPause,
            (IntentType::Stop, _) => Intent::Stop,
            (IntentType::Next, _) => Intent::Next,
            (IntentType::Previous, _) => Intent::Previous,
            (IntentType::Mute, _) => Intent::Mute,
            (IntentType::Unmute, _) => Intent::Unmute,
            (IntentType::PowerToggle, _) => Intent::PowerToggle,
            (IntentType::PowerOn, _) => Intent::PowerOn,
            (IntentType::PowerOff, _) => Intent::PowerOff,

            // Fallback for unmatched combinations
            _ => return None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rotate_to_volume_change() {
        let route = Route {
            input: InputType::Rotate,
            intent: IntentType::VolumeChange,
            params: RouteParams { damping: 80.0 },
        };

        let input = InputPrimitive::Rotate { delta: 0.03 };
        let intent = route.apply(&input).unwrap();
        match intent {
            Intent::VolumeChange { delta } => {
                assert!((delta - 2.4).abs() < 0.001); // 0.03 * 80
            }
            _ => panic!("expected VolumeChange"),
        }
    }

    #[test]
    fn test_press_to_playpause() {
        let route = Route {
            input: InputType::Press,
            intent: IntentType::PlayPause,
            params: RouteParams::default(),
        };

        let input = InputPrimitive::Press;
        let intent = route.apply(&input).unwrap();
        assert_eq!(intent, Intent::PlayPause);
    }

    #[test]
    fn test_swipe_to_next() {
        let route = Route {
            input: InputType::SwipeRight,
            intent: IntentType::Next,
            params: RouteParams::default(),
        };

        let input = InputPrimitive::Swipe {
            direction: crate::primitives::Direction::Right,
        };
        assert_eq!(route.apply(&input).unwrap(), Intent::Next);

        // Wrong direction should not match
        let wrong = InputPrimitive::Swipe {
            direction: crate::primitives::Direction::Left,
        };
        assert!(route.apply(&wrong).is_none());
    }

    #[test]
    fn test_unmatched_input_drops() {
        let route = Route {
            input: InputType::Press,
            intent: IntentType::Play,
            params: RouteParams::default(),
        };

        let input = InputPrimitive::Rotate { delta: 0.1 };
        assert!(route.apply(&input).is_none());
    }
}
