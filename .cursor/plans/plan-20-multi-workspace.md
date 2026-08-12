# Plan 20 — Multi-workspace product UX

Maps to roadmap **Plan 20**. Builds on ADR [0019](../../docs/decisions/0019-workspaces-are-better-auth-organizations.md) (workspaces = Better Auth organizations) and Plan 14/16 membership plumbing.

## Goal

Let a signed-in user create additional workspaces, switch the active one in the app shell, rename the current workspace, land in an invited workspace after accept, and keep PAT/MCP bound to `users.default_workspace_id` (updated on switch/create/invite).

## Exit criteria

- [x] Sidebar workspace switcher lists memberships and switches `activeOrganizationId`
- [x] Switching also updates `users.defaultWorkspaceId` (PAT/MCP alignment)
- [x] Create workspace sheet → BA `createOrganization` → active + default → `/dashboard`
- [x] Settings → Workspace rename (owner/admin); slug read-only
- [x] Settings → API keys shows default workspace and allows setting it
- [x] Invite accept sets active (BA) + default workspace, then dashboard
- [x] Docs: `workspaces.mdx` + roadmap Plan 19
- [x] `typecheck` / `lint` / `test` green

## Locked decisions

- Switch updates both session active org and PAT default (one mental model)
- Ops env keys (`MCP_API_KEY`) stay on seeded env default
- No delete/leave/transfer ownership UI in this plan
- Slug immutable after create
