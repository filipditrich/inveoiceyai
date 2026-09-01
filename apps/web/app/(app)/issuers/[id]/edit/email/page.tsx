import { IssuerEmailForm } from "@/components/issuers/issuer-email-form";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerForEdit } from "@/lib/load-issuer";

type Params = Promise<{ id: string }>;
type Search = Promise<{ invalid?: string }>;

export default async function IssuerEditEmailPage({
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
    <IssuerEmailForm
      emailSettings={issuer.emailSettings}
      invalidQuery={sp.invalid ?? null}
      issuerId={issuer.id}
    />
  );
}
