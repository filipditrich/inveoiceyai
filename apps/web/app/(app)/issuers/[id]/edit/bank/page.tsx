import { IssuerBankForm } from "@/components/issuers/issuer-bank-form";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerForEdit } from "@/lib/load-issuer";

type Params = Promise<{ id: string }>;
type Search = Promise<{ invalid?: string }>;

export default async function IssuerEditBankPage({
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
    <IssuerBankForm
      invalidQuery={sp.invalid ?? null}
      snapshot={issuer.snapshot}
    />
  );
}
