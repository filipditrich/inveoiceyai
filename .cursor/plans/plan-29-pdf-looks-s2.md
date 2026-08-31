# Plan 29 — PDF looks S2 (community publish)

**Status:** done
**ADR:** [0039](../../docs/decisions/0039-looks-are-data-react-pdf-interprets.md)
**Spec:** [pdf-looks-community.md](../../docs/specs/pdf-looks-community.md)

## Goal

Publish a workspace look into a global community catalog. Pro workspaces can apply published community looks. No review queue.

## Order

1. `origin: community`, `communityLookFrom`, `lookIsPublishable`, picker listing — tests in `invoice-core`
2. `community_looks` table + SQL + repo
3. Catalog load includes published community documents
4. Publish / unpublish actions + editor + picker origin badge

Takedown and licensing are not this plan.
