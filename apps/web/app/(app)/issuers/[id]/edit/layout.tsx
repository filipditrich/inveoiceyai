import { IssuerEditNav } from "@/components/issuers/issuer-edit-nav";
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
        <h1 className="text-2xl font-semibold tracking-tight">
          {issuer.snapshot.name}
        </h1>
        <p className="text-muted-foreground text-sm">{t("editSectionsHint")}</p>
      </div>
      <IssuerEditNav issuerId={id} />
      {children}
    </div>
  );
}
