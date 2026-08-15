import { IssuerCreateForm } from "@/components/issuers/issuer-create-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { BriefcaseBusinessIcon } from "lucide-react";

type Search = Promise<{ invalid?: string }>;

export default async function IssuersNewPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  await requireWorkspace();
  const sp = await searchParams;
  const t = await getTranslations("Issuers");

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <PageHeader
        description={t("newSubtitle")}
        icon={<BriefcaseBusinessIcon />}
        title={t("newTitle")}
      />
      <IssuerCreateForm invalidQuery={sp.invalid ?? null} />
    </div>
  );
}
