import { defineAgent } from "eve";

export default defineAgent({
  model: process.env.INVOICEY_AI_MODEL ?? "openai/gpt-4o-mini",
});
