export const MCP_READ_SCOPE = "invoicey:read";
export const MCP_WRITE_SCOPE = "invoicey:write";

export const MCP_TOOL_PERMISSIONS: Record<string, string> = {
  update_invoice_draft: "invoices:create",
  list_clients: "clients:read",
  lookup_business: "clients:read",
  search_business: "clients:read",
  get_workspace: "issuers:read",
  list_invoices: "invoices:read",
  get_invoice: "invoices:read",
  create_invoice: "invoices:create",
  issue_invoice: "invoices:issue",
  mark_invoice_paid: "payments:manage",
  send_invoice_email: "invoices:send",
  list_presets: "issuers:read",
  get_preset: "issuers:read",
  save_preset: "issuers:manage",
  delete_preset: "issuers:manage",
};
const writes = new Set([
  "create_invoice",
  "update_invoice_draft",
  "issue_invoice",
  "mark_invoice_paid",
  "send_invoice_email",
  "save_preset",
  "delete_preset",
]);
export function mcpToolPolicy(name: string) {
  const readOnly = !writes.has(name);
  return {
    scope: readOnly ? MCP_READ_SCOPE : MCP_WRITE_SCOPE,
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: !readOnly && name !== "create_invoice",
      idempotentHint:
        readOnly ||
        name === "issue_invoice" ||
        name === "mark_invoice_paid" ||
        name === "delete_preset",
      openWorldHint: [
        "lookup_business",
        "search_business",
        "send_invoice_email",
        "mark_invoice_paid",
      ].includes(name),
    },
  };
}
