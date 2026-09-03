import {
  revokeUserApiKeyAction,
  revokeUserDeviceAction,
  revokeUserDriveDeviceAction,
  revokeUserSessionAction,
} from "@/actions/admin-control";
import {
  AdminEmpty,
  AdminMiniTable,
  AdminSection,
} from "@/components/admin/admin-detail-kit";
import { SubmitButton } from "@/components/ui/submit-button";
import { getFormatter, getTranslations } from "next-intl/server";

import type { adminListUserAccess } from "@/lib/admin/user-access";

type Access = Awaited<ReturnType<typeof adminListUserAccess>>;

export async function AdminUserAccessSections({
  userId,
  access,
}: {
  userId: string;
  access: Access;
}) {
  const [t, format] = await Promise.all([
    getTranslations("Admin.userDetail"),
    getFormatter(),
  ]);

  return (
    <>
      <AdminSection
        description={t("sessionsDescription")}
        title={t("sessionsTitle")}
      >
        {access.sessions.length === 0 ? (
          <AdminEmpty>{t("noSessions")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.created"),
              t("columns.expires"),
              t("columns.ip"),
              t("columns.userAgent"),
              "",
            ]}
            rows={access.sessions.map((row) => [
              <span key="created" className="whitespace-nowrap tabular-nums">
                {format.dateTime(row.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>,
              <span key="expires" className="whitespace-nowrap tabular-nums">
                {format.dateTime(row.expiresAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>,
              row.ipAddress ?? "—",
              <span key="ua" className="max-w-[18rem] truncate text-xs">
                {row.userAgent ?? "—"}
              </span>,
              <form key="revoke" action={revokeUserSessionAction}>
                <input name="userId" type="hidden" value={userId} />
                <input name="sessionId" type="hidden" value={row.id} />
                <SubmitButton size="sm" variant="ghost">
                  {t("actions.revoke")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>

      <AdminSection
        description={t("devicesDescription")}
        title={t("devicesTitle")}
      >
        {access.devices.length === 0 ? (
          <AdminEmpty>{t("noDevices")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.label"),
              t("columns.lastSeen"),
              t("columns.ip"),
              "",
            ]}
            rows={access.devices.map((row) => [
              row.label ?? "—",
              <span key="seen" className="whitespace-nowrap tabular-nums">
                {format.dateTime(row.lastSeenAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>,
              row.lastIp ?? "—",
              <form key="revoke" action={revokeUserDeviceAction}>
                <input name="userId" type="hidden" value={userId} />
                <input name="deviceId" type="hidden" value={row.id} />
                <SubmitButton size="sm" variant="ghost">
                  {t("actions.revoke")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>

      <AdminSection
        description={t("apiKeysDescription")}
        title={t("apiKeysTitle")}
      >
        {access.apiKeys.length === 0 ? (
          <AdminEmpty>{t("noApiKeys")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.name"),
              t("columns.prefix"),
              t("columns.lastRequest"),
              t("columns.enabled"),
              "",
            ]}
            rows={access.apiKeys.map((row) => [
              row.name ?? "—",
              <span key="prefix" className="font-mono text-xs">
                {row.prefix || row.start || "—"}
              </span>,
              row.lastRequest ? (
                <span key="last" className="whitespace-nowrap tabular-nums">
                  {format.dateTime(row.lastRequest, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              ) : (
                "—"
              ),
              row.enabled === false ? t("disabled") : t("enabled"),
              <form key="revoke" action={revokeUserApiKeyAction}>
                <input name="userId" type="hidden" value={userId} />
                <input name="apiKeyId" type="hidden" value={row.id} />
                <SubmitButton size="sm" variant="ghost">
                  {t("actions.revoke")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>

      <AdminSection description={t("driveDescription")} title={t("driveTitle")}>
        {access.driveDevices.length === 0 ? (
          <AdminEmpty>{t("noDriveDevices")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.name"),
              t("columns.lastSeen"),
              t("columns.fingerprint"),
              "",
            ]}
            rows={access.driveDevices.map((row) => [
              row.name,
              <span key="seen" className="whitespace-nowrap tabular-nums">
                {format.dateTime(row.lastSeenAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>,
              <span key="fp" className="font-mono text-xs">
                {row.tokenFingerprint}
              </span>,
              <form key="revoke" action={revokeUserDriveDeviceAction}>
                <input name="userId" type="hidden" value={userId} />
                <input name="deviceId" type="hidden" value={row.id} />
                <SubmitButton size="sm" variant="ghost">
                  {t("actions.revoke")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>
    </>
  );
}
