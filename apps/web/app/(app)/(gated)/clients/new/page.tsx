import { ClientEditorForm } from "@/components/clients/client-editor-form";
import { getTranslations } from "next-intl/server";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("newTitle")}
        </h1>
        <p className="text-muted-foreground">{t("newSubtitle")}</p>
      </div>
      <ClientEditorForm invalidQuery={sp.invalid ?? null} mode="create" />
    </div>
  );
}
