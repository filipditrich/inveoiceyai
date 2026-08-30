/**
 * How a tool call is named while it runs, shared by every surface.
 *
 * Slack renders these as Thinking Steps rows and the assistant panel as
 * progress lines, so a tool that reads "Searching ARES…" in a thread reads the
 * same in the app. Deliberately dependency-free: the panel imports it into the
 * browser bundle.
 */
export const TOOL_LABELS: Record<string, string> = {
  ask_question: "Asking you…",
  search_business: "Searching ARES…",
  lookup_business: "Looking up company in ARES…",
  list_presets: "Loading presets…",
  get_preset: "Loading preset…",
  save_preset: "Saving preset…",
  create_invoice: "Creating invoice draft…",
  update_invoice_draft: "Updating draft…",
  upload_invoice_files: "Uploading PDF and ISDOC…",
  list_invoices: "Listing invoices…",
  get_invoice: "Loading invoice…",
  issue_invoice: "Issuing invoice…",
  mark_invoice_paid: "Marking invoice paid…",
  send_invoice_email: "Sending invoice email…",
};

export function toolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

/** Tools gated by Eve `approval: always()` — these park for Allow/Deny. */
export const HITL_TOOL_NAMES = new Set([
  "issue_invoice",
  "mark_invoice_paid",
  "send_invoice_email",
]);

/**
 * Eve's built-in question tool. It parks the turn like an approval does, but
 * the two ask the user for different things and must not share wording — being
 * told you are "waiting for approval" when the agent asked you a question is
 * how a conversation stalls.
 */
export const ASK_QUESTION_TOOL = "ask_question";
