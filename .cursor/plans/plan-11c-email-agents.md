# Plan 11c — Email agent surfaces

Maps to roadmap **Plan 11c**. Spec: [`docs/specs/email.md`](../../docs/specs/email.md).

## Goal

Expose `send_invoice_email` on MCP and Eve (HITL), reusing the same ops path as the web UI.

## Exit criteria

- [x] MCP tool registered (+ `cc`)
- [x] Eve HITL tool wired
- [x] `mcp.md` + `slack-eve.md` updated
- [ ] Manual: Cursor MCP send + Slack HITL send (operator)

## Notes

- Do not silently default `to` when the client has no `contactEmail`.
