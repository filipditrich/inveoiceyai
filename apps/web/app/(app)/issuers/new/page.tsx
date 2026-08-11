import { IssuerCreateForm } from "@/components/issuers/issuer-create-form";
import { requireWorkspace } from "@/lib/auth/session";

type Search = Promise<{ invalid?: string }>;

export default async function IssuersNewPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  await requireWorkspace();
  const sp = await searchParams;

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Nový vystavovatel
        </h1>
        <p className="text-muted-foreground">
          IČO přes ARES, kontaktní e-mail a banka. Ostatní nastavení doplníte v
          sekcích po vytvoření.
        </p>
      </div>
      <IssuerCreateForm invalidQuery={sp.invalid ?? null} />
    </div>
  );
}
