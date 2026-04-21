"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteMapping, type Mapping } from "@/lib/api";
import { useUIDispatch } from "@/lib/ws";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRowSelectionRegistration } from "@/hooks/useRowSelection";

interface Props {
  mapping: Mapping;
  /** Optional display name of the resolved service target (zone/light name). */
  targetLabel?: string;
}

export function MappingRow({ mapping, targetLabel }: Props) {
  const dispatch = useUIDispatch();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { isSelected } = useRowSelectionRegistration({
    id: `mapping:${mapping.mapping_id}`,
    primaryMappingId: mapping.mapping_id,
  });

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    dispatch({ kind: "local_delete_mapping", id: mapping.mapping_id });
    try {
      await deleteMapping(mapping.mapping_id);
      setDeleteOpen(false);
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const routesSummary = mapping.routes
    .map((r) => `${r.input}→${r.intent}`)
    .join(", ");

  return (
    <div
      data-selected={isSelected ? "true" : undefined}
      className={`rounded-md border bg-white px-4 py-2 text-sm shadow-sm dark:bg-zinc-900 ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500"
          : "border-zinc-950/5 dark:border-white/10"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={mapping.active ? "green" : "zinc"}>
          {mapping.active ? "active" : "inactive"}
        </Badge>
        {mapping.edge_id && <Badge color="zinc">{mapping.edge_id}</Badge>}
        <span className="font-medium text-zinc-950 dark:text-white">
          {mapping.device_type}/{shorten(mapping.device_id)}
        </span>
        <span className="text-zinc-400">→</span>
        <span className="font-medium text-zinc-950 dark:text-white">
          {mapping.service_type}/{targetLabel || shorten(mapping.service_target)}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <Link
            href={`/mappings/${mapping.mapping_id}/edit`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            edit
          </Link>
          <Button
            plain
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="!text-red-600 !px-0"
          >
            delete
          </Button>
        </div>
      </div>
      {mapping.routes.length > 0 && (
        <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {mapping.routes.length} route{mapping.routes.length === 1 ? "" : "s"}:{" "}
          {routesSummary}
        </div>
      )}

      <Dialog
        open={deleteOpen}
        onClose={() => (deleting ? null : setDeleteOpen(false))}
        size="sm"
      >
        <DialogTitle>Delete this mapping?</DialogTitle>
        <DialogDescription>
          {mapping.device_type}/{shorten(mapping.device_id)} →{" "}
          {mapping.service_type}/
          {targetLabel || shorten(mapping.service_target)} will be removed.
          This cannot be undone.
        </DialogDescription>
        {deleteError && (
          <DialogBody>
            <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
              {deleteError}
            </div>
          </DialogBody>
        )}
        <DialogActions>
          <Button
            plain
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button color="red" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function shorten(s: string): string {
  return s.length > 20 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s;
}
