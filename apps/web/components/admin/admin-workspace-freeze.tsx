import {
  freezeWorkspaceAction,
  unfreezeWorkspaceAction,
} from "@/actions/admin-control";
import { AdminFacts, AdminSection } from "@/components/admin/admin-detail-kit";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { getFormatter, getTranslations } from "next-intl/server";

export async function AdminWorkspaceFreezeSection({
  workspaceId,
  frozenAt,
  freezeReason,
}: {
  workspaceId: string;
  frozenAt: Date | null;
  freezeReason: string | null;
}) {
  const [t, format] = await Promise.all([
    getTranslations("Admin.workspaceDetail.freeze"),
    getFormatter(),
  ]);
  const frozen = frozenAt != null;

  return (
    <AdminSection
      className={frozen ? "border-destructive/40" : undefined}
      description={t("description")}
      title={t("title")}
    >
      <AdminFacts
        items={[
          {
            label: t("status"),
            value: (
              <Badge variant={frozen ? "destructive" : "secondary"}>
                {frozen ? t("frozen") : t("live")}
              </Badge>
            ),
          },
          {
            label: t("since"),
            value: frozenAt
              ? format.dateTime(frozenAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—",
          },
          {
            label: t("reason"),
            value: freezeReason ?? "—",
          },
        ]}
      />

      {frozen ? (
        <form action={unfreezeWorkspaceAction} className="mt-6">
          <input name="workspaceId" type="hidden" value={workspaceId} />
          <SubmitButton size="sm">{t("unfreeze")}</SubmitButton>
        </form>
      ) : (
        <form action={freezeWorkspaceAction} className="mt-6 space-y-3">
          <input name="workspaceId" type="hidden" value={workspaceId} />
          <div className="space-y-2">
            <Label htmlFor="freeze-reason">{t("reasonLabel")}</Label>
            <Textarea
              id="freeze-reason"
              maxLength={500}
              name="reason"
              required
              rows={3}
            />
          </div>
          <SubmitButton size="sm" variant="destructive">
            {t("freeze")}
          </SubmitButton>
        </form>
      )}
    </AdminSection>
  );
}
