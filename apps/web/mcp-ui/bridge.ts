import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import { OpenAIExtensions } from "@openai/mcp-extensions/app";
import { z } from "zod";

import { PayloadSchema, type Payload } from "./contract";
import type {
  CallToolResult,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
export const app = new App(
  { name: "Invoicey", version: "1.0.0" },
  {},
  { autoResize: true },
);
export const extensions = new OpenAIExtensions(app);
type State = {
  payload: Payload | null;
  locale: "cs" | "en";
  ready: boolean;
  error: boolean;
  appUrl: string;
  permissions: string[] | null;
};
let state: State = {
  payload: null,
  locale: "cs",
  ready: false,
  error: false,
  appUrl: "https://invoicey.app",
  permissions: null,
};
const listeners = new Set<() => void>();
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const snapshot = () => state;
function update(change: Partial<State>) {
  state = { ...state, ...change };
  document.documentElement.lang = state.locale;
  for (const listener of listeners) listener();
}
const MetadataSchema = z.object({
  appUrl: z.string().url().optional(),
  permissions: z.array(z.string()).optional(),
});
export function receive(
  result: Pick<CallToolResult, "structuredContent" | "isError" | "_meta">,
) {
  const parsed = PayloadSchema.safeParse(result.structuredContent);
  if (!parsed.success || result.isError || parsed.data.ok === false) {
    update({ error: true });
    return false;
  }
  const meta = MetadataSchema.safeParse(result._meta).data;
  const appUrl = meta?.appUrl ?? state.appUrl;
  const permissions = meta?.permissions ?? state.permissions;
  update({ payload: parsed.data, error: false, appUrl, permissions });
  return true;
}
app.ontoolresult = receive;
app.ontoolcancelled = () => update({ error: true });
app.onhostcontextchanged = (context) => {
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables)
    applyHostStyleVariables(context.styles.variables);
  if (context.locale)
    update({ locale: context.locale.startsWith("cs") ? "cs" : "en" });
};
let connecting: Promise<void> | undefined;
export function connect() {
  connecting ??= app
    .connect()
    .then(() => {
      const context = app.getHostContext();
      if (context?.theme) applyDocumentTheme(context.theme);
      if (context?.styles?.variables)
        applyHostStyleVariables(context.styles.variables);
      update({
        ready: true,
        locale: context?.locale?.startsWith("en") ? "en" : "cs",
      });
    })
    .catch(() => {
      update({ error: true });
    });
  return connecting;
}
export async function call(
  name: string,
  args: NonNullable<CallToolRequest["params"]["arguments"]>,
) {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError) throw new Error("Tool failed");
  const payload = PayloadSchema.parse(result.structuredContent);
  if (payload.ok === false) throw new Error("Operation failed");
  return { ...result, payload };
}
