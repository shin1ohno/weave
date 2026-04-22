"use client";

import type { Mapping, TargetCandidate } from "@/lib/api";
import { TargetCandidatesSection } from "@/components/TargetCandidatesSection";

interface Props {
  mapping: Mapping;
  onUpdate: <K extends keyof Mapping>(key: K, value: Mapping[K]) => void;
}

/** Thin wrapper over the existing TargetCandidatesSection, exposing the
 * same capability under the "Switch-mode candidates" header so the
 * RoutesEditor has a consistent vocabulary (target switching, not the
 * lower-level "candidates"). The underlying component will be renamed /
 * moved in Phase 6 cleanup. */
export function TargetSwitchingBox({ mapping, onUpdate }: Props) {
  return (
    <TargetCandidatesSection
      candidates={mapping.target_candidates ?? []}
      switchOn={mapping.target_switch_on ?? null}
      onCandidatesChange={(next: TargetCandidate[]) =>
        onUpdate("target_candidates", next)
      }
      onSwitchOnChange={(next: string | null) =>
        onUpdate("target_switch_on", next)
      }
      serviceType={mapping.service_type}
      serviceTarget={mapping.service_target}
    />
  );
}
