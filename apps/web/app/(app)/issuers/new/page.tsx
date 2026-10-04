import { IssuerCreateForm } from "@/components/issuers/issuer-create-form";
import { IssuerQuotaNotice } from "@/components/issuers/issuer-quota-notice";
import { PageHeader } from "@/components/layout/page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { getIssuerQuota } from "@/lib/entitlements/quotas";
import { BriefcaseBusinessIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

type Search = Promise<{ invalid?: string }>;

export default async function IssuersNewPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { workspaceId } = await requireWorkspace();
  const quota = await getIssuerQuota(workspaceId);
  const sp = await searchParams;
  const t = await getTranslations("Issuers");

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/issuers", label: t("back") }}
        description={t("newSubtitle")}
        eyebrow={t("title")}
        icon={<BriefcaseBusinessIcon />}
        title={t("newTitle")}
      />
      {!quota.canCreate && quota.limit !== null ? (
        <IssuerQuotaNotice limit={quota.limit} />
      ) : (
        <IssuerCreateForm invalidQuery={sp.invalid ?? null} />
      )}
    </div>
  );
}
