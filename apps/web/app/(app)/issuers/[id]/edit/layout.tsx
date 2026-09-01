import { setDefaultIssuer } from "@/actions/issuers";
import { IssuerEditNav } from "@/components/issuers/issuer-edit-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerForEdit } from "@/lib/load-issuer";
import { BriefcaseBusinessIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

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
                size="sm"
                variant="outline"
              >
                {tTable("setDefault")}
              </SubmitButton>
            </form>
          )
        }
        description={t("editSectionsHint")}
        eyebrow={
          <Link
            className="underline-offset-4 hover:text-foreground hover:underline"
            href="/issuers"
          >
            {t("title")}
          </Link>
        }
        icon={<BriefcaseBusinessIcon />}
        title={issuer.snapshot.name}
      />
      <IssuerEditNav issuerId={id} />
      {children}
    </div>
  );
}
