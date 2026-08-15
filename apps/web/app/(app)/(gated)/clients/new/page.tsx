import { ClientEditorForm } from "@/components/clients/client-editor-form";
import { PageHeader } from "@/components/layout/page-header";
import { getTranslations } from "next-intl/server";
import { ContactRoundIcon } from "lucide-react";

type Search = Promise<{ invalid?: string }>;

export default async function ClientsNewPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;
  const t = await getTranslations("Clients");

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <PageHeader
        description={t("newSubtitle")}
        icon={<ContactRoundIcon />}
        title={t("newTitle")}
      />
      <ClientEditorForm invalidQuery={sp.invalid ?? null} mode="create" />
    </div>
  );
}
