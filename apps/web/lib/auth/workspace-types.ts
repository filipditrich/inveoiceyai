export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceListItem {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: WorkspaceRole;
}
