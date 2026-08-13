import { setDefaultIssuer } from "@/actions/issuers";
import { IssuerEditNav } from "@/components/issuers/issuer-edit-nav";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { loadIssuerForEdit } from "@/lib/load-issuer";
import { requireWorkspace } from "@/lib/auth/session";
import Link from "next/link";
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">
          <Link
            className="hover:text-foreground underline-offset-4 hover:underline"
            href="/issuers"
          >
            {t("title")}
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {issuer.snapshot.name}
          </h1>
          {issuer.isDefault ? (
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
          )}
        </div>
        <p className="text-muted-foreground text-sm">{t("editSectionsHint")}</p>
      </div>
      <IssuerEditNav issuerId={id} />
      {children}
    </div>
  );
}
