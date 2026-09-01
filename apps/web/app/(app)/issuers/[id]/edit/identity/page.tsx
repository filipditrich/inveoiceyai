import { IssuerIdentityForm } from "@/components/issuers/issuer-identity-form";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerForEdit } from "@/lib/load-issuer";

type Params = Promise<{ id: string }>;
type Search = Promise<{ invalid?: string }>;

export default async function IssuerEditIdentityPage({
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
    <IssuerIdentityForm
      invalidQuery={sp.invalid ?? null}
      snapshot={issuer.snapshot}
      source={issuer.source}
    />
  );
}
