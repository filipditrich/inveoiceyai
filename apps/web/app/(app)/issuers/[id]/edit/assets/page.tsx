import { IssuerAssetsForm } from "@/components/issuers/issuer-assets-form";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerForEdit } from "@/lib/load-issuer";

type Params = Promise<{ id: string }>;
type Search = Promise<{ invalid?: string }>;

export default async function IssuerEditAssetsPage({
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
  const uploadConfigured = Boolean(process.env.UPLOADTHING_TOKEN?.trim());

  return (
    <IssuerAssetsForm
      invalidQuery={sp.invalid ?? null}
      snapshot={issuer.snapshot}
      uploadConfigured={uploadConfigured}
    />
  );
}
