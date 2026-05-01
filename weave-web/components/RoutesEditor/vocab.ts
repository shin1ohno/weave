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
  // Long-touch (sustained hold on a screen edge). Distinct from touch
  // — Nuimo emits these on different BLE codes (8..=11 vs 4..=7).
  "long_touch_top",
  "long_touch_bottom",
  "long_touch_left",
  "long_touch_right",
  // In-air wave (hand passes above the device without touching). Nuimo
  // only emits left / right; vertical motion is reported as `hover`.
  "fly_left",
  "fly_right",
  "key_press",
  // Numbered buttons (Hue Tap Dial: 1..=4). Other multi-button
  // controllers can reuse the same vocabulary.
  "button_1",
  "button_2",
  "button_3",
  "button_4",
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

// ---------------------------------------------------------------------------
// Conversation-builder vocabulary.
//
// The D2 "conversation builder" UI renders each route as a sentence:
//   "When I [gesture], [verb] [object] on [target]."
// Picker popovers and inline validation read from these maps. Keep them in
// sync with INPUT_TYPES / INTENT_TYPES above — additions to either need a
// matching entry here so the chip renders something sensible.
//
// `*_KIND` separates continuous gestures (rotate / slide) from discrete
// gestures so the intent picker can pre-filter to the right shortlist.
// `*_LABEL` / `*_VERB` / `*_OBJECT` provide the human-readable surface text.
// ---------------------------------------------------------------------------

export const GESTURE_KIND: Record<string, "continuous" | "discrete"> = {
  rotate: "continuous",
  slide: "continuous",
  press: "discrete",
  release: "discrete",
  long_press: "discrete",
  hover: "discrete",
  key_press: "discrete",
  swipe_up: "discrete",
  swipe_down: "discrete",
  swipe_left: "discrete",
  swipe_right: "discrete",
  touch_top: "discrete",
  touch_bottom: "discrete",
  touch_left: "discrete",
  touch_right: "discrete",
  long_touch_top: "discrete",
  long_touch_bottom: "discrete",
  long_touch_left: "discrete",
  long_touch_right: "discrete",
  fly_left: "discrete",
  fly_right: "discrete",
  button_1: "discrete",
  button_2: "discrete",
  button_3: "discrete",
  button_4: "discrete",
};

export const INTENT_KIND: Record<string, "continuous" | "discrete"> = {
  volume_change: "continuous",
  volume_set: "continuous",
  brightness_change: "continuous",
  brightness_set: "continuous",
  seek_relative: "continuous",
  seek_absolute: "continuous",
  play: "discrete",
  pause: "discrete",
  play_pause: "discrete",
  stop: "discrete",
  next: "discrete",
  previous: "discrete",
  mute: "discrete",
  unmute: "discrete",
  power_toggle: "discrete",
  power_on: "discrete",
  power_off: "discrete",
};

export const INTENT_VERB: Record<string, string> = {
  volume_change: "change",
  volume_set: "set",
  brightness_change: "change",
  brightness_set: "set",
  seek_relative: "seek",
  seek_absolute: "jump to",
  play: "play",
  pause: "pause",
  play_pause: "play / pause",
  stop: "stop",
  next: "skip to next",
  previous: "go back",
  mute: "mute",
  unmute: "unmute",
  power_toggle: "toggle power",
  power_on: "turn on",
  power_off: "turn off",
};

export const INTENT_OBJECT: Record<string, string> = {
  volume_change: "the volume",
  volume_set: "the volume to",
  brightness_change: "the brightness",
  brightness_set: "the brightness to",
  seek_relative: "forward / back",
  seek_absolute: "a position",
};

export const GESTURE_LABEL: Record<string, string> = {
  rotate: "rotate",
  press: "press",
  release: "release",
  long_press: "press & hold",
  swipe_up: "swipe up",
  swipe_down: "swipe down",
  swipe_left: "swipe left",
  swipe_right: "swipe right",
  slide: "slide",
  hover: "hover",
  touch_top: "touch top",
  touch_bottom: "touch bottom",
  touch_left: "touch left",
  touch_right: "touch right",
  long_touch_top: "long touch top",
  long_touch_bottom: "long touch bottom",
  long_touch_left: "long touch left",
  long_touch_right: "long touch right",
  fly_left: "fly left",
  fly_right: "fly right",
  key_press: "press a key",
  button_1: "button 1",
  button_2: "button 2",
  button_3: "button 3",
  button_4: "button 4",
};

// Service → domain mapping. Drives the feedback-template suggestions and
// the template-library categorisation. `generic` is the fallback for any
// service we haven't categorised yet — its templates pulse-on-any-state
// without assuming the service emits volume / brightness / track metadata.
export const SERVICE_DOMAIN: Record<
  string,
  "playback" | "light" | "generic"
> = {
  roon: "playback",
  spotify: "playback",
  sonos: "playback",
  hue: "light",
  shelly: "light",
  ikea: "light",
  ios_media: "playback",
  macos_music: "playback",
};

export interface FeedbackTemplate {
  id: string;
  label: string;
  description: string;
  glyph: string;
  state: string;
  feedback_type: string;
}

export const FEEDBACK_TEMPLATES_BY_DOMAIN: Record<
  "playback" | "light" | "generic",
  FeedbackTemplate[]
> = {
  playback: [
    {
      id: "volume_bar",
      label: "Volume bar",
      description: "Show a vertical bar when volume changes",
      glyph: "vol",
      state: "volume",
      feedback_type: "volume_bar",
    },
    {
      id: "playback_glyph",
      label: "Play / pause",
      description: "Show the play or pause icon when playback changes",
      glyph: "play",
      state: "playback",
      feedback_type: "playback_glyph",
    },
    {
      id: "track_scroll",
      label: "Track name",
      description: "Scroll the currently playing track name",
      glyph: "play",
      // The edge runtime matches `rule.state` against the live publish
      // property. iOS NowPlayingObserver publishes
      // `property: "now_playing"` with a composite value `{title, artist, …}`;
      // the track-scroll feedback path extracts `value.title` from there.
      // Saving as `"now_playing"` makes the rule match without a runtime
      // alias step.
      state: "now_playing",
      feedback_type: "track_scroll",
    },
    {
      id: "mute_glyph",
      label: "Mute indicator",
      description: "Show the mute icon when muted",
      glyph: "vol",
      state: "muted",
      feedback_type: "mute_glyph",
    },
  ],
  light: [
    {
      id: "brightness_bar",
      label: "Brightness bar",
      description: "Show a vertical bar when brightness changes",
      glyph: "vol",
      state: "brightness",
      feedback_type: "brightness_bar",
    },
    {
      id: "power_glyph",
      label: "On / off glyph",
      description: "Show the on or off icon when toggled",
      glyph: "bulb",
      state: "on",
      feedback_type: "power_glyph",
    },
    {
      id: "color_swatch",
      label: "Color swatch",
      description: "Show the current color",
      glyph: "bulb",
      state: "color",
      feedback_type: "color_swatch",
    },
  ],
  generic: [
    {
      id: "pulse",
      label: "Pulse",
      description: "Pulse the matrix on any state change",
      glyph: "zap",
      state: "any",
      feedback_type: "pulse",
    },
  ],
};

/**
 * Returns the feedback templates appropriate for a given `service_type`.
 * Domain-matched templates come first, then the generic `pulse` fallback so
 * the user can always opt for "do something on any change". When the domain
 * is itself `generic`, the generic templates are returned alone — no
 * duplicates.
 */
export function feedbackTemplatesFor(serviceType: string): FeedbackTemplate[] {
  const domain = SERVICE_DOMAIN[serviceType] ?? "generic";
  const primary = FEEDBACK_TEMPLATES_BY_DOMAIN[domain] ?? [];
  if (domain === "generic") return primary;
  return [...primary, ...FEEDBACK_TEMPLATES_BY_DOMAIN.generic];
}

/**
 * Default feedback rules to seed a brand-new mapping with, derived from
 * the service's domain. The user can remove any rule they don't want,
 * but the typical playback / light experience needs the LED to react
 * out of the box — without these defaults, a fresh Roon or Music
 * mapping ships with `feedback: []` and the user discovers a dark
 * Nuimo on next/prev / volume changes.
 *
 * Returns the *primary* domain's templates (volume_bar, playback_glyph,
 * track_scroll, mute_glyph for playback; brightness_bar, power_glyph
 * for light). The generic `pulse` fallback is intentionally NOT
 * included by default — it's an opt-in catch-all the user picks via
 * the template picker if they want it.
 */
export function defaultFeedbackForService(
  serviceType: string,
): { state: string; feedback_type: string; mapping: Record<string, never> }[] {
  const domain = SERVICE_DOMAIN[serviceType] ?? "generic";
  if (domain === "generic") return [];
  const templates = FEEDBACK_TEMPLATES_BY_DOMAIN[domain] ?? [];
  return templates.map((t) => ({
    state: t.state,
    feedback_type: t.feedback_type,
    mapping: {},
  }));
}
