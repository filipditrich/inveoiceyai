import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import {
  AdminEmpty,
  AdminMiniTable,
} from "@/components/admin/admin-detail-kit";
import { Badge } from "@/components/ui/badge";
import type { AdminAuditRow } from "@/lib/admin/detail";

/** Metadata is free-form jsonb; render the few fields worth reading inline. */
const SUMMARY_FIELDS = [
  "targetEmail",
  "email",
  "workspaceName",
  "amount",
  "role",
  "from",
  "to",
  "note",
] as const;

function summarise(metadata: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const field of SUMMARY_FIELDS) {
    const value = metadata[field];
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${field}: ${String(value)}`);
  }
  return parts.join(" · ");
}

export async function AdminAuditList({
  events,
  showWorkspace = false,
}: {
  events: AdminAuditRow[];
  showWorkspace?: boolean;
}) {
  const t = await getTranslations("Admin.audit");
  const format = await getFormatter();

  if (events.length === 0) {
    return <AdminEmpty>{t("empty")}</AdminEmpty>;
  }

  const headers = [t("columns.event"), t("columns.actor")];
  if (showWorkspace) {
    headers.push(t("columns.workspace"));
  }
  headers.push(t("columns.details"), t("columns.at"));

  return (
    <AdminMiniTable
      headers={headers}
      rows={events.map((event) => {
        const cells = [
          <Badge key="type" variant="secondary" className="font-mono text-xs">
            {event.type}
          </Badge>,
          event.actorEmail ?? "—",
        ];
        if (showWorkspace) {
          cells.push(
            event.workspaceId ? (
              <Link
                key="ws"
                className="hover:underline"
                href={`/admin/workspaces/${event.workspaceId}`}
              >
                {event.workspaceName ?? event.workspaceId}
              </Link>
            ) : (
              "—"
            ),
          );
        }
        cells.push(
          <span key="meta" className="text-muted-foreground text-xs">
            {summarise(event.metadata) || "—"}
          </span>,
          <span key="at" className="whitespace-nowrap tabular-nums">
            {format.dateTime(event.createdAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>,
        );
        return cells;
      })}
    />
  );
}
