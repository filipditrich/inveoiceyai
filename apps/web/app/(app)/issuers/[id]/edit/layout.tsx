import { setDefaultIssuer } from "@/actions/issuers";
import { IssuerEditNav } from "@/components/issuers/issuer-edit-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerForEdit } from "@/lib/load-issuer";
import { BriefcaseBusinessIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

type Params = Promise<{ id: string }>;

export default async function IssuerEditLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const t = await getTranslations("Issuers");
  const tTable = await getTranslations("Issuers.table");
  const { id } = await params;
  const { workspaceId } = await requireWorkspace();
  const issuer = await loadIssuerForEdit(workspaceId, id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        actions={
          issuer.isDefault ? (
            <Badge variant="secondary">{tTable("defaultBadge")}</Badge>
          ) : (
            <form action={setDefaultIssuer}>
              <input name="from" type="hidden" value="edit" />
              <input name="id" type="hidden" value={id} />
              <SubmitButton
                pendingLabel={tTable("setDefault")}
                variant="outline"
              >
                {tTable("setDefault")}
              </SubmitButton>
            </form>
          )
        }
        back={{ href: "/issuers", label: t("back") }}
        description={t("editSectionsHint")}
        eyebrow={t("title")}
        icon={<BriefcaseBusinessIcon />}
        title={issuer.snapshot.name}
      />
      <IssuerEditNav issuerId={id} />
      {children}
    </div>
  );
}
