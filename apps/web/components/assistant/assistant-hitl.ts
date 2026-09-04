/**
 * Eve parks a turn with a built-in prompt when the session input budget
 * is spent. The wording is framework copy ("defective long-running
 * sessions") — detect it so the panel can say something a user can act on.
 */
export function isSessionBudgetPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    lower.includes("input-token limit") ||
    lower.includes("maxinputtokenspersession")
  );
}
