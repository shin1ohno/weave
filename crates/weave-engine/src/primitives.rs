use serde::{Deserialize, Serialize};

/// Physical input primitives from devices.
/// These are device-agnostic — a Nuimo rotate and a dial rotate produce the same primitive.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum InputPrimitive {
    /// Continuous rotation. delta: normalized change per event.
    Rotate { delta: f64 },
    /// Button press.
    Press,
    /// Button release.
    Release,
    /// Long press.
    LongPress,
    /// Directional swipe on a surface.
    Swipe { direction: Direction },
    /// Slider or linear input. value: 0.0-1.0.
    Slide { value: f64 },
    /// Proximity/hover. proximity: 0.0 (closest) to 1.0 (farthest).
    Hover { proximity: f64 },
    /// Touch on a specific area.
    Touch { area: TouchArea },
    /// Long touch on a specific area.
    LongTouch { area: TouchArea },
    /// Numbered key press (StreamDeck, etc.).
    KeyPress { key: u32 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TouchArea {
    Top,
    Bottom,
    Left,
    Right,
}

/// The type of an input primitive (without data), used as routing key.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InputType {
    Rotate,
    Press,
    Release,
    LongPress,
    SwipeUp,
    SwipeDown,
    SwipeLeft,
    SwipeRight,
    Slide,
    Hover,
    TouchTop,
    TouchBottom,
    TouchLeft,
    TouchRight,
    LongTouchTop,
    LongTouchBottom,
    LongTouchLeft,
    LongTouchRight,
    KeyPress { key: u32 },
}

impl InputPrimitive {
    /// Extract the input type (routing key) from a concrete primitive.
    pub fn input_type(&self) -> InputType {
        match self {
            InputPrimitive::Rotate { .. } => InputType::Rotate,
            InputPrimitive::Press => InputType::Press,
            InputPrimitive::Release => InputType::Release,
            InputPrimitive::LongPress => InputType::LongPress,
            InputPrimitive::Swipe { direction } => match direction {
                Direction::Up => InputType::SwipeUp,
                Direction::Down => InputType::SwipeDown,
                Direction::Left => InputType::SwipeLeft,
                Direction::Right => InputType::SwipeRight,
            },
            InputPrimitive::Slide { .. } => InputType::Slide,
            InputPrimitive::Hover { .. } => InputType::Hover,
            InputPrimitive::Touch { area } => match area {
                TouchArea::Top => InputType::TouchTop,
                TouchArea::Bottom => InputType::TouchBottom,
                TouchArea::Left => InputType::TouchLeft,
                TouchArea::Right => InputType::TouchRight,
            },
            InputPrimitive::LongTouch { area } => match area {
                TouchArea::Top => InputType::LongTouchTop,
                TouchArea::Bottom => InputType::LongTouchBottom,
                TouchArea::Left => InputType::LongTouchLeft,
                TouchArea::Right => InputType::LongTouchRight,
            },
            InputPrimitive::KeyPress { key } => InputType::KeyPress { key: *key },
        }
    }
}
