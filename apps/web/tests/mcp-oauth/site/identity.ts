import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "./auth";
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session.user;
}
export async function listUserWorkspaces(_userId: string) {
  return [
    { id: "workspace-a", name: "Test Studio" },
    { id: "workspace-b", name: "Second Studio" },
  ];
}
export async function requireMcpWorkspace(_user: string, workspace: string) {
  if (!["workspace-a", "workspace-b"].includes(workspace))
    throw new APIError("FORBIDDEN");
  return workspace;
}
