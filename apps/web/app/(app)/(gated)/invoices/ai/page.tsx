import { AssistantHandoff } from "@/components/assistant/assistant-handoff";

/**
 * The old one-shot "AI draft" page.
 *
 * Drafting moved into the assistant panel, which is available on every screen
 * and can ask follow-up questions instead of guessing. The route is kept
 * because it is linked from the invoices list, the dashboard and the create
 * menu — it now opens the panel and hands over to the invoices list.
 */
export default function InvoiceAiPage() {
  return <AssistantHandoff />;
}
