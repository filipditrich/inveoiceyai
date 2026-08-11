import { redirect } from "next/navigation";

type Params = Promise<{ id: string }>;

export default async function IssuerEditIndexPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  redirect(`/issuers/${id}/edit/identity`);
}
