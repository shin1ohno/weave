"use client";

import * as Headless from "@headlessui/react";
import clsx from "clsx";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Check, Plus, type LucideIcon } from "@/components/icon";

export interface ComboboxOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** Optional muted secondary text shown after the label inside the popover. */
  description?: string;
  disabled?: boolean;
}

export interface ComboboxGroup {
  label: string;
  options: ComboboxOption[];
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Flat option list. Mutually exclusive with `groups`. */
  options?: ComboboxOption[];
  /** Sectioned option list with non-interactive headings. */
  groups?: ComboboxGroup[];
  /** Allow committing a value not present in `options`/`groups`. The
   * current value is preserved even when out of list, and pressing Enter
   * on an unmatched query commits the typed string. Defaults to false. */
  allowCustom?: boolean;
  /** Defaults to true. Disable to hide the filter cue. Typed input is
   * still ignored when there's nothing to match. */
  searchable?: boolean;
  placeholder?: string;
  /** Shown when the filtered list is empty AND `allowCustom` either
   * isn't set or hasn't yet produced a custom-suggest row. */
  emptyState?: ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  /** Optional leading icon shown in the trigger when no option icon is
   * available — e.g. for free-form fields the caller wants to label
   * with a fixed glyph regardless of value. */
  triggerIcon?: LucideIcon;
  /** Trigger density.
   *  - "default" matches Catalyst `Input` / `Select` (Field/Label use)
   *  - "sm" is a tighter pill matching the hi-fi RouteRow chip group:
   *    rounded-md + px-2 py-1 + text-xs */
  size?: "default" | "sm";
  /** Render the trigger value in a monospaced font — useful for technical
   * identifiers (INPUT_TYPES, intents, service targets) so the trigger
   * matches the route-pill aesthetic. */
  mono?: boolean;
}

const TRIGGER_FRAME_DEFAULT =
  "relative block w-full " +
  "before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm dark:before:hidden " +
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500 " +
  "has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none";

const TRIGGER_FRAME_SM =
  "relative block w-full " +
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:ring-transparent after:ring-inset focus-within:after:ring-2 focus-within:after:ring-blue-500 " +
  "has-data-disabled:opacity-50";

const TRIGGER_INPUT_DEFAULT =
  "relative block w-full appearance-none rounded-lg py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)] " +
  "pr-[calc(--spacing(10)-1px)] sm:pr-[calc(--spacing(9)-1px)] " +
  "text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white " +
  "border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20 " +
  "bg-transparent dark:bg-white/5 " +
  "focus:outline-hidden " +
  "data-disabled:border-zinc-950/20 dark:data-disabled:border-white/15 dark:data-disabled:bg-white/2.5 dark:data-hover:data-disabled:border-white/15";

const TRIGGER_INPUT_SM =
  "relative block w-full appearance-none rounded-md py-1 pr-7 " +
  "text-xs text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100 " +
  "border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20 " +
  "bg-white dark:bg-zinc-900 " +
  "focus:outline-hidden " +
  "data-disabled:border-zinc-950/20 dark:data-disabled:border-white/15 dark:data-disabled:bg-zinc-950";

const POPOVER =
  "[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(4)] " +
  "isolate min-w-[calc(var(--input-width)+8px)] scroll-py-1 rounded-xl p-1 select-none empty:invisible " +
  "outline outline-transparent focus:outline-hidden " +
  "overflow-y-auto overscroll-contain max-h-[min(60vh,400px)] " +
  "bg-white dark:bg-zinc-800 " +
  "shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 dark:ring-inset " +
  "transition-opacity duration-100 ease-in data-closed:data-leave:opacity-0 data-transition:pointer-events-none";

const OPTION =
  "group/option flex w-full cursor-default items-center gap-2 rounded-lg py-1.5 pr-2 pl-3 text-sm/6 " +
  "text-zinc-950 dark:text-white " +
  "outline-hidden data-focus:bg-blue-500 data-focus:text-white " +
  "data-disabled:opacity-50";

export function Combobox({
  value,
  onChange,
  options,
  groups,
  allowCustom = false,
  searchable = true,
  placeholder,
  emptyState,
  disabled,
  className,
  "aria-label": ariaLabel,
  triggerIcon,
  size = "default",
  mono = false,
}: Props) {
  const [query, setQuery] = useState("");
  const isSm = size === "sm";
  const triggerFrame = isSm ? TRIGGER_FRAME_SM : TRIGGER_FRAME_DEFAULT;
  const triggerInput = isSm ? TRIGGER_INPUT_SM : TRIGGER_INPUT_DEFAULT;

  const allOptions = useMemo<ComboboxOption[]>(() => {
    if (groups) return groups.flatMap((g) => g.options);
    return options ?? [];
  }, [options, groups]);

  const matchedOption = useMemo(
    () => allOptions.find((o) => o.value === value),
    [allOptions, value]
  );

  // Filter groups (or wrap flat options as a single unlabeled group) by
  // query. Filtering is always performed when there's a query — disabling
  // `searchable` only removes the visual "(searchable)" affordance, which
  // we currently express implicitly via the input itself. Empty groups
  // are dropped from the popover entirely.
  const visibleGroups = useMemo<ComboboxGroup[]>(() => {
    const source: ComboboxGroup[] = groups
      ? groups
      : [{ label: "", options: options ?? [] }];
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source
      .map((g) => ({
        label: g.label,
        options: g.options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.value.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.options.length > 0);
  }, [options, groups, query]);

  const totalVisible = visibleGroups.reduce(
    (s, g) => s + g.options.length,
    0
  );

  const trimmedQuery = query.trim();
  const showCustomRow =
    allowCustom &&
    trimmedQuery.length > 0 &&
    !allOptions.some(
      (o) => o.value.toLowerCase() === trimmedQuery.toLowerCase()
    );

  const TriggerIcon = matchedOption?.icon ?? triggerIcon;

  return (
    <Headless.Combobox
      value={value}
      onChange={(next: string | null) => {
        if (next == null) return;
        onChange(next);
      }}
      onClose={() => setQuery("")}
      disabled={disabled}
      immediate={false}
    >
      <span
        data-slot="control"
        className={clsx(className, triggerFrame)}
      >
        {TriggerIcon && (
          <span
            className={clsx(
              "pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center text-zinc-500 dark:text-zinc-400",
              isSm ? "pl-2" : "pl-3 sm:pl-2.5"
            )}
            aria-hidden
          >
            <TriggerIcon
              className={isSm ? "h-3 w-3" : "h-4 w-4 sm:h-3.5 sm:w-3.5"}
            />
          </span>
        )}
        <Headless.ComboboxInput
          aria-label={ariaLabel}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          // We render a fresh value-string every keystroke; Headless
          // doesn't rerender displayValue while the user types.
          displayValue={(v: string | null) =>
            v != null ? (allOptions.find((o) => o.value === v)?.label ?? v) : ""
          }
          onChange={(e) => searchable && setQuery(e.target.value)}
          readOnly={!searchable}
          className={clsx(
            triggerInput,
            mono && "font-mono",
            TriggerIcon
              ? isSm
                ? "pl-7"
                : "pl-[calc(--spacing(9)-1px)] sm:pl-[calc(--spacing(8)-1px)]"
              : isSm
                ? "pl-2"
                : "pl-[calc(--spacing(3.5)-1px)] sm:pl-[calc(--spacing(3)-1px)]"
          )}
        />
        <Headless.ComboboxButton
          className="group absolute inset-y-0 right-0 flex items-center px-1.5"
          aria-label={
            ariaLabel ? `${ariaLabel} options` : "Open options"
          }
        >
          <ChevronDown
            className={clsx(
              "stroke-zinc-500 group-data-disabled:stroke-zinc-600 group-data-hover:stroke-zinc-700 dark:stroke-zinc-400 dark:group-data-hover:stroke-zinc-300",
              isSm ? "h-3 w-3" : "h-5 w-5 sm:h-4 sm:w-4"
            )}
            aria-hidden
          />
        </Headless.ComboboxButton>
      </span>
      <Headless.ComboboxOptions transition anchor="bottom start" className={POPOVER}>
        {/* Show display only — keep value as `displayLabel` */}
        {visibleGroups.length === 0 && !showCustomRow ? (
          <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
            {emptyState ?? (allowCustom ? "Type to add a custom value." : "No matches.")}
          </div>
        ) : (
          visibleGroups.map((g, gi) => (
            <Fragment key={g.label || `g-${gi}`}>
              {g.label && (
                <div
                  className={clsx(
                    "px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
                    gi > 0 && "border-t border-zinc-950/5 dark:border-white/10"
                  )}
                  role="presentation"
                >
                  {g.label}
                </div>
              )}
              {g.options.map((opt) => (
                <Headless.ComboboxOption
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={OPTION}
                >
                  {opt.icon && (
                    <opt.icon className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-data-focus/option:text-white dark:text-zinc-400" />
                  )}
                  <span className="truncate">{opt.label}</span>
                  {opt.description && (
                    <span className="truncate text-xs text-zinc-500 group-data-focus/option:text-white/80 dark:text-zinc-400">
                      {opt.description}
                    </span>
                  )}
                  <Check
                    className="ml-auto h-3.5 w-3.5 shrink-0 opacity-0 group-data-selected/option:opacity-100"
                    aria-hidden
                  />
                </Headless.ComboboxOption>
              ))}
            </Fragment>
          ))
        )}
        {showCustomRow && (
          <>
            {totalVisible > 0 && (
              <div className="my-1 h-px bg-zinc-950/5 dark:bg-white/10" role="separator" />
            )}
            <Headless.ComboboxOption
              value={trimmedQuery}
              className={clsx(OPTION, "italic")}
            >
              <Plus className="h-3.5 w-3.5 shrink-0 text-blue-600 group-data-focus/option:text-white dark:text-blue-400" />
              <span className="truncate">
                Use{" "}
                <span className="not-italic font-mono">
                  &quot;{trimmedQuery}&quot;
                </span>
              </span>
            </Headless.ComboboxOption>
          </>
        )}
        {totalVisible === 0 && !showCustomRow && emptyState == null && allowCustom && (
          <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
            Type to add a custom value.
          </div>
        )}
      </Headless.ComboboxOptions>
    </Headless.Combobox>
  );
}

/** Display-only label for a Combobox value. Used when consumers want to
 * mirror the option's label in summary text. */
export function comboboxLabelOf(
  value: string,
  options: ComboboxOption[] | undefined,
  groups: ComboboxGroup[] | undefined
): string {
  const all = groups ? groups.flatMap((g) => g.options) : (options ?? []);
  return all.find((o) => o.value === value)?.label ?? value;
}
