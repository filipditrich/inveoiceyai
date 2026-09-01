import { ClientEditorForm } from "@/components/clients/client-editor-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { clientsAreManaged } from "@/lib/entitlements/managed-clients";
import { ContactRoundIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

type Search = Promise<{ invalid?: string }>;

export default async function ClientsNewPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  // A managed workspace has no client it may create or edit (ADR 0036). The
  // server actions refuse anyway, but a refused action only redirects — the
  // form would sit there doing nothing, which reads as a broken page.
  const { workspaceId: managedCheckWorkspaceId } = await requireWorkspace();
  if (await clientsAreManaged(managedCheckWorkspaceId)) {
    redirect("/clients");
  }

  const sp = await searchParams;
  const t = await getTranslations("Clients");

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("newSubtitle")}
        icon={<ContactRoundIcon />}
        title={t("newTitle")}
      />
      <ClientEditorForm invalidQuery={sp.invalid ?? null} mode="create" />
    </div>
  );
}
