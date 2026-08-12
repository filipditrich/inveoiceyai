import { shouldGateIssuerWelcome } from "@/lib/issuer-welcome";
import { requireWorkspace } from "@/lib/auth/session";
import { redirect } from "next/navigation";

/**
 * Issuer welcome gate for product surfaces that need an issuer.
 * Kept outside `/welcome`, `/issuers`, and `/settings` so a soft redirect
 * cannot loop when `x-pathname` is stale across Next.js RSC redirects.
 */
export default async function IssuerWelcomeGateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { workspaceId } = await requireWorkspace();
  if (await shouldGateIssuerWelcome(workspaceId)) {
    redirect("/welcome");
  }
  return children;
}
