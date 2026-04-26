"use client";

import {
  Circle,
  Lightbulb,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Settings,
  Trash2,
  Volume2,
  X,
  type LucideIcon,
} from "@/components/icon";
import type { Template } from "@/lib/templates";

// Per-template card menu (rename / duplicate / delete) for the
// conversation-builder template strip. Ports
// `/tmp/anthropic-design-fetch/weave/project/hifi-routes-d2.jsx`
// lines 222-257 verbatim modulo lucide icons (the d2 mock used a custom
// `Glyph` component keyed by string; we use the shared lucide map below).
//
// The menu and the gear button that opens it are only rendered for
// non-builtin (user-authored) templates. The main card itself is an
// absolute-positioned button covering the entire surface so a click
// anywhere on the card applies the template; the gear button sits at
// `z-20` and `stopPropagation`s so opening the menu does not also fire
// `onClick`. This mirrors d2's `group/tpl` reveal-on-hover affordance.

/** Glyph-name → lucide icon. The `icon` field on a Template is a short
 * string (`"play"`, `"bulb"`, `"vol"`, …) that travels through the API.
 * Add new entries here when a new domain/template is introduced; unknown
 * names fall back to `Settings` at the call site. */
const GLYPH_ICON: Record<string, LucideIcon> = {
  play: Play,
  bulb: Lightbulb,
  vol: Volume2,
  plus: Plus,
  press: Circle,
  rotate: RotateCw,
};

interface TemplateCardMenuProps {
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function TemplateCardMenu({
  onRename,
  onDuplicate,
  onDelete,
}: TemplateCardMenuProps) {
  return (
    <div className="absolute right-1 top-7 z-30 w-40 rounded-lg border border-zinc-950/10 bg-white p-1 shadow-xl dark:border-white/15 dark:bg-zinc-800">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRename();
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5"
      >
        <Pencil aria-hidden className="h-2.5 w-2.5" />
        Rename
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5"
      >
        <Plus aria-hidden className="h-2.5 w-2.5" />
        Duplicate
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
      >
        <Trash2 aria-hidden className="h-2.5 w-2.5" />
        Delete
      </button>
    </div>
  );
}

/** Narrows the `template` prop's union to the `__new__` sentinel so the
 *  rest of the component body can treat the value as a real `Template`. */
function isNewCard(
  t: Template | { id: "__new__" }
): t is { id: "__new__" } {
  return t.id === "__new__";
}

export interface TemplateCardProps {
  /** Pass the special id `"__new__"` to render the "Save as template" dashed card. */
  template: Template | { id: "__new__" };
  /** Whether this card is the currently-selected/applied template. */
  selected?: boolean;
  /** Standard template card click — applies the template to the current edit form. */
  onClick?: () => void;
  /** "__new__" card click — opens the Save-as-template modal. */
  onSaveAsNew?: () => void;
  /** Per-card menu state controlled by the parent (only one menu open at a time). */
  openMenu?: string | null;
  setOpenMenu?: (next: string | null) => void;
  /** Per-card menu actions — called by the dropdown. */
  onRename?: (t: Template) => void;
  onDuplicate?: (t: Template) => void;
  onDelete?: (t: Template) => void;
}

export function TemplateCard({
  template,
  selected,
  onClick,
  onSaveAsNew,
  openMenu,
  setOpenMenu,
  onRename,
  onDuplicate,
  onDelete,
}: TemplateCardProps) {
  // "__new__" card — dashed-border CTA that opens the Save-as-template
  // modal. Always rendered last in the strip so the user's eye lands on
  // existing templates first.
  if (isNewCard(template)) {
    return (
      <button
        type="button"
        onClick={onSaveAsNew}
        className="group/tnew flex flex-col items-start justify-center gap-1 rounded-xl border border-dashed border-zinc-300 p-3 text-left transition hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-700 dark:border-zinc-700 dark:hover:bg-blue-500/10"
      >
        <div className="flex items-center gap-1.5 text-zinc-500 group-hover/tnew:text-blue-700">
          <X aria-hidden className="h-3.5 w-3.5 rotate-45" />
          <span className="text-[13px] font-semibold">
            Save as template…
          </span>
        </div>
        <span className="text-[11px] text-zinc-400">
          turn the current rules + feedback into a reusable template
        </span>
      </button>
    );
  }

  const t: Template = template;
  const Icon = GLYPH_ICON[t.icon] ?? Settings;
  const cls = selected
    ? "border-blue-600 bg-blue-50 ring-2 ring-blue-500/30 dark:bg-blue-500/15"
    : "border-zinc-950/10 bg-white hover:border-zinc-950/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20";
  const menuOpen = openMenu === t.id;

  return (
    <div
      className={`group/tpl relative flex min-w-0 flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${cls}`}
    >
      {/* Whole-card hit target. Sits at z-0 with the inner content at
       *  z-10 so the gear button (z-20) and menu (z-30) can intercept
       *  clicks without bubbling to apply-the-template. */}
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`apply ${t.label}`}
      />
      <div className="relative z-10 flex w-full min-w-0 flex-wrap items-center gap-1.5">
        <Icon
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-300"
        />
        <span className="truncate text-[13px] font-semibold">{t.label}</span>
        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-white/5">
          {t.routes.length}
        </span>
        {t.builtin ? (
          <span
            title="built-in (read-only)"
            className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded bg-zinc-100 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-white/5"
          >
            built-in
          </span>
        ) : (
          <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            yours
          </span>
        )}
      </div>
      <span className="relative z-10 line-clamp-2 w-full break-words text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
        {t.description}
      </span>
      {!t.builtin && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenu?.(menuOpen ? null : t.id);
          }}
          aria-label={`template options for ${t.label}`}
          className="absolute right-1 top-1 z-20 rounded p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-700 group-hover/tpl:opacity-100 dark:hover:bg-white/5 dark:hover:text-zinc-200"
        >
          <Settings aria-hidden className="h-3 w-3" />
        </button>
      )}
      {!t.builtin && menuOpen && (
        <TemplateCardMenu
          onRename={() => {
            setOpenMenu?.(null);
            onRename?.(t);
          }}
          onDuplicate={() => {
            setOpenMenu?.(null);
            onDuplicate?.(t);
          }}
          onDelete={() => {
            setOpenMenu?.(null);
            onDelete?.(t);
          }}
        />
      )}
    </div>
  );
}
