// Curated input/intent vocabularies surfaced in the RoutesEditor dropdowns.
// Kept in sync with the server's `InputType` / `IntentType` enums (see
// crates/weave-engine/src/primitives.rs and intents.rs). "Other" is handled
// via a catch-all <option> at the call site — if the server ships a novel
// intent, the RouteRow still shows it without dropping the value.

export const INPUT_TYPES = [
  "rotate",
  "press",
  "release",
  "long_press",
  "swipe_up",
  "swipe_down",
  "swipe_left",
  "swipe_right",
  "slide",
  "hover",
  "touch_top",
  "touch_bottom",
  "touch_left",
  "touch_right",
  "key_press",
];

export const INTENT_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Playback",
    items: ["play", "pause", "play_pause", "stop", "next", "previous"],
  },
  {
    label: "Continuous",
    items: [
      "volume_change",
      "volume_set",
      "brightness_change",
      "brightness_set",
      "seek_relative",
      "seek_absolute",
    ],
  },
  {
    label: "Toggle",
    items: ["mute", "unmute", "power_toggle", "power_on", "power_off"],
  },
];

export const INTENT_TYPES = INTENT_GROUPS.flatMap((g) => g.items);
