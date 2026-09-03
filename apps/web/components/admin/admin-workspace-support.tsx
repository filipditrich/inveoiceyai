import {
  disconnectWorkspaceBankAction,
  liftEmailSuppressionAction,
  unpublishCommunityLookAction,
} from "@/actions/admin-control";
import {
  AdminEmpty,
  AdminMiniTable,
  AdminSection,
} from "@/components/admin/admin-detail-kit";
import { SubmitButton } from "@/components/ui/submit-button";
import { getFormatter, getTranslations } from "next-intl/server";

import type {
  AdminBankConnectionRow,
  AdminCommunityLookRow,
  AdminSuppressionRow,
} from "@/lib/admin/workspace-control";

export async function AdminWorkspaceSupportSections({
  workspaceId,
  banks,
  suppressions,
  looks,
}: {
  workspaceId: string;
  banks: AdminBankConnectionRow[];
  suppressions: AdminSuppressionRow[];
  looks: AdminCommunityLookRow[];
}) {
  const [t, format] = await Promise.all([
    getTranslations("Admin.workspaceDetail"),
    getFormatter(),
  ]);

  return (
    <>
      <AdminSection
        description={t("banks.description")}
        title={t("banks.title")}
      >
        {banks.length === 0 ? (
          <AdminEmpty>{t("banks.empty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.provider"),
              t("columns.status"),
              t("columns.error"),
              t("columns.lastSync"),
              "",
            ]}
            rows={banks.map((row) => [
              row.provider,
              row.status,
              row.lastSyncErrorCode ?? "—",
              row.lastSyncSucceededAt ? (
                <span key="sync" className="whitespace-nowrap tabular-nums">
                  {format.dateTime(row.lastSyncSucceededAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              ) : (
                "—"
              ),
              <form key="disconnect" action={disconnectWorkspaceBankAction}>
                <input name="workspaceId" type="hidden" value={workspaceId} />
                <input name="connectionId" type="hidden" value={row.id} />
                <input name="provider" type="hidden" value={row.provider} />
                <SubmitButton size="sm" variant="ghost">
                  {t("actions.disconnect")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>

      <AdminSection
        description={t("suppressions.description")}
        title={t("suppressions.title")}
      >
        {suppressions.length === 0 ? (
          <AdminEmpty>{t("suppressions.empty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.email"),
              t("columns.reason"),
              t("columns.when"),
              "",
            ]}
            rows={suppressions.map((row) => [
              row.email,
              row.reason,
              <span key="at" className="whitespace-nowrap tabular-nums">
                {format.dateTime(row.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>,
              <form key="lift" action={liftEmailSuppressionAction}>
                <input name="workspaceId" type="hidden" value={workspaceId} />
                <input name="email" type="hidden" value={row.email} />
                <SubmitButton size="sm" variant="ghost">
                  {t("actions.lift")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>

      <AdminSection
        description={t("looks.description")}
        title={t("looks.title")}
      >
        {looks.length === 0 ? (
          <AdminEmpty>{t("looks.empty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[t("columns.look"), t("columns.version"), ""]}
            rows={looks.map((row) => [
              <span key="id" className="font-mono text-xs">
                {row.lookId}
              </span>,
              row.version,
              <form key="unpublish" action={unpublishCommunityLookAction}>
                <input name="workspaceId" type="hidden" value={workspaceId} />
                <input name="lookId" type="hidden" value={row.lookId} />
                <SubmitButton size="sm" variant="ghost">
                  {t("actions.unpublish")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>
    </>
  );
}
