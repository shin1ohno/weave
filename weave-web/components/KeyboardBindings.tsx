"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCommandUI } from "@/hooks/useCommandUI";
import { useRowSelection } from "@/hooks/useRowSelection";

/**
 * Global keyboard bindings for the Live Console. Mounted once at the root
 * layout. Listens on the document so keys work regardless of focus.
 *
 * Rules:
 * - All binds short-circuit when the user is typing in an input, textarea,
 *   select, or contenteditable element. Exception: `Esc` and `⌘K/Ctrl+K`
 *   always fire so the user can dismiss overlays / open the palette from
 *   within a form input.
 * - IME composition (`e.isComposing`) is always respected — never hijack
 *   keys while Japanese/Chinese/Korean IME is active.
 *
 * Bindings:
 *   ⌘K / Ctrl+K   — toggle command palette
 *   /             — open palette (no inline search input exists yet)
 *   ?             — toggle help overlay
 *   Esc           — close palette / help
 *   j / ↓         — next row
 *   k / ↑         — previous row
 *   Enter         — default action for selected row (edit mapping if any)
 *   e             — open edit drawer for selected row's primary mapping
 *   n             — new mapping
 *   s             — reserved for Phase 3 SwitchTargetPopover (TODO)
 */
export function KeyboardBindings() {
  const router = useRouter();
  const {
    paletteOpen,
    openPalette,
    closePalette,
    togglePalette,
    helpOpen,
    closeHelp,
    toggleHelp,
  } = useCommandUI();
  const { moveNext, movePrev, getSelectedMeta } = useRowSelection();

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof Element)) return false;
      return !!target.closest("input,textarea,select,[contenteditable]");
    }

    function onKeyDown(e: KeyboardEvent) {
      // Always respect IME composition.
      if (e.isComposing) return;

      const typing = isTypingTarget(e.target);

      // ⌘K / Ctrl+K — always active (even inside inputs) so the palette is
      // reachable without first blurring the form.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
        return;
      }

      // Esc — close overlays even when typing. The drawer owns its own Esc.
      if (e.key === "Escape") {
        if (paletteOpen) {
          e.preventDefault();
          closePalette();
          return;
        }
        if (helpOpen) {
          e.preventDefault();
          closeHelp();
          return;
        }
        return;
      }

      // Remaining binds are blocked while typing.
      if (typing) return;

      // Modifier keys (other than shift for `?`) shouldn't hijack — keeps
      // browser shortcuts like Ctrl+R / Cmd+L untouched.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "?": {
          e.preventDefault();
          toggleHelp();
          return;
        }
        case "/": {
          // No top-level inline search input exists in Phase 4; fall back
          // to opening the palette. When a Phase 5+ search field lands,
          // this should focus it instead.
          e.preventDefault();
          openPalette();
          return;
        }
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          moveNext();
          return;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          movePrev();
          return;
        }
        case "Enter": {
          const meta = getSelectedMeta();
          if (!meta) return;
          if (meta.primaryMappingId) {
            e.preventDefault();
            router.push(`/mappings/${meta.primaryMappingId}/edit`);
          } else if (meta.defaultHref) {
            e.preventDefault();
            router.push(meta.defaultHref);
          }
          // Rows without a default action (edges): silently no-op.
          return;
        }
        case "e": {
          const meta = getSelectedMeta();
          if (meta?.primaryMappingId) {
            e.preventDefault();
            router.push(`/mappings/${meta.primaryMappingId}/edit`);
          }
          return;
        }
        case "n": {
          e.preventDefault();
          router.push("/mappings/new");
          return;
        }
        case "s": {
          // TODO(phase-3): wire to SwitchTargetPopover once the popover
          // component lands. Held back intentionally so the keybind and
          // popover ship together.
          return;
        }
        default:
          return;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    paletteOpen,
    helpOpen,
    openPalette,
    closePalette,
    togglePalette,
    closeHelp,
    toggleHelp,
    moveNext,
    movePrev,
    getSelectedMeta,
    router,
  ]);

  return null;
}
