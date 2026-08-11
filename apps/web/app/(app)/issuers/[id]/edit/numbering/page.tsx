import { IssuerNumberingForm } from "@/components/issuers/issuer-numbering-form";
import { loadIssuerForEdit } from "@/lib/load-issuer";
import { requireWorkspace } from "@/lib/auth/session";

type Params = Promise<{ id: string }>;
type Search = Promise<{ invalid?: string }>;

export default async function IssuerEditNumberingPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspaceId } = await requireWorkspace();
  const issuer = await loadIssuerForEdit(workspaceId, id);

  return (
    <IssuerNumberingForm
      invalidQuery={sp.invalid ?? null}
      issuerId={issuer.id}
      issuerName={issuer.snapshot.name}
      schemes={issuer.schemes}
    />
  );
}
