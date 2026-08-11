import { IssuerCreateForm } from "@/components/issuers/issuer-create-form";
import { requireWorkspace } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
        <p className="text-muted-foreground">{t("newSubtitle")}</p>
      </div>
      <IssuerCreateForm invalidQuery={sp.invalid ?? null} />
    </div>
  );
}
