import {
  RotateCw,
  Circle,
  Target,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Move,
  Hand,
  Keyboard,
  Play,
  Pause,
  Lightbulb,
  Volume2,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  Battery,
  Dot,
  Zap,
  GripVertical,
  X,
  Link2,
  Settings,
  Command,
  Pencil,
  Check,
  WifiOff,
  Radio,
  Cpu,
  Send,
  AlertCircle,
  Disc3,
  Trash2,
  type LucideIcon,
} from "lucide-react";

// Maps a weave route `input` string → lucide icon. Covers the gesture
// vocabulary: rotate, press, long_press, swipe_*, slide, hover, touch_*,
// key_press. Unknown inputs fall back to Circle at the call site.
export const INPUT_ICON: Record<string, LucideIcon> = {
  rotate: RotateCw,
  press: Circle,
  release: Circle,
  long_press: Target,
  swipe_up: ArrowUp,
  swipe_down: ArrowDown,
  swipe_left: ArrowLeft,
  swipe_right: ArrowRight,
  slide: Move,
  hover: Hand,
  touch_top: ArrowUp,
  touch_bottom: ArrowDown,
  touch_left: ArrowLeft,
  touch_right: ArrowRight,
  key_press: Keyboard,
  // Hue Tap Dial: numbered buttons share the same Circle icon as a
  // generic press; each maps to its own route input string.
  button_1: Circle,
  button_2: Circle,
  button_3: Circle,
  button_4: Circle,
};

/** Maps device_type → lucide icon. Used by tiles and the input-stream
 * panel to identify the source of an event. Nuimo has its own bespoke
 * NuimoViz visual rendered separately; this map covers the rest. */
export const DEVICE_ICON: Record<string, LucideIcon> = {
  hue_tap_dial: Disc3,
};

/** Maps service_type → lucide icon. Roon = Play, Hue = Lightbulb. Extend as
 * more services are added on the server side. */
export const SERVICE_ICON: Record<string, LucideIcon> = {
  roon: Play,
  hue: Lightbulb,
};

/** Toolbar/chrome icons used across the 3-pane view, Try it panel, and
 * Command palette. Re-exported under a neutral name so the consumer sites
 * don't couple to lucide directly. */
export {
  Play,
  Pause,
  Volume2,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
  Battery,
  Dot,
  Zap,
  GripVertical,
  X,
  Link2,
  Settings,
  Command,
  Pencil,
  Check,
  WifiOff,
  Circle,
  Target,
  RotateCw,
  Lightbulb,
  Radio,
  Cpu,
  Send,
  AlertCircle,
  Disc3,
  Trash2,
};

export type { LucideIcon };
