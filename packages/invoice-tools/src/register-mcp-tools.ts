import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { createAndRenderInvoice, lookupBusiness } from "./handlers";
import { jsonToolResult } from "./mcp-json-result";
import {
  deletePreset,
  getPreset,
  listPresets,
  savePreset,
  type PresetKind,
} from "./presets";

const presetKindSchema = z.enum(["issuer", "invoice_template"]);
const jsonObjectSchema = z.record(z.string(), z.any());

/** Narrowed registrar — full McpServer.tool() generics blow TS instantiation depth. */
type ToolRegistrar = {
  tool: (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: Record<string, unknown>) => Promise<{
      content: Array<{ type: "text"; text: string }>;
      isError?: boolean;
    }>,
  ) => unknown;
};

/** Registers Plan 12a tools on an MCP server (stdio or HTTP). */
export function registerInvoiceyMcpTools(server: McpServer): void {
  const s = server as unknown as ToolRegistrar;

  s.tool(
    "lookup_business",
    "Look up a Czech economic subject by IČO (8 digits) via ARES. Returns draft client fields (no `id`).",
    { ico: z.string().describe("Eight-digit IČO") },
    async (args) => {
      const ico = String(args.ico ?? "");
      const r = await lookupBusiness(ico);
      return jsonToolResult(r, !r.ok);
    },
  );

  s.tool(
    "create_invoice",
    "Assemble a draft invoice (optional issuer/template presets), validate against InvoiceSchema, and render PDF + ISDOC. Issuer is locked server-side.",
    {
      draft: jsonObjectSchema
        .optional()
        .describe(
          "Partial invoice: meta, client, vat, payment, items (issuer ignored).",
        ),
      issuerPresetId: z
        .string()
        .uuid()
        .optional()
        .describe("Preset id of kind issuer"),
      templatePresetId: z
        .string()
        .uuid()
        .optional()
        .describe("Preset id of kind invoice_template"),
    },
    async (args) => {
      const r = await createAndRenderInvoice({
        draft: args.draft,
        issuerPresetId:
          typeof args.issuerPresetId === "string"
            ? args.issuerPresetId
            : undefined,
        templatePresetId:
          typeof args.templatePresetId === "string"
            ? args.templatePresetId
            : undefined,
      });
      return jsonToolResult(r, !r.ok);
    },
  );

  s.tool(
    "list_presets",
    "List locally saved issuer and invoice_template presets.",
    {
      kind: presetKindSchema
        .optional()
        .describe("Filter by issuer or invoice_template"),
    },
    async (args) => {
      const kind =
        args.kind === "issuer" || args.kind === "invoice_template"
          ? (args.kind as PresetKind)
          : undefined;
      const r = await listPresets({ kind });
      return jsonToolResult(r);
    },
  );

  s.tool(
    "get_preset",
    "Get one preset by id.",
    { id: z.string().uuid() },
    async (args) => {
      const r = await getPreset({ id: String(args.id ?? "") });
      return jsonToolResult(r, !r.ok);
    },
  );

  s.tool(
    "save_preset",
    "Create or update a local preset (issuer snapshot or invoice_template draft).",
    {
      id: z.string().uuid().optional().describe("Omit to create a new preset"),
      kind: presetKindSchema,
      name: z.string().min(1).max(120),
      data: jsonObjectSchema.describe(
        "IssuerSnapshot or partial invoice draft object",
      ),
    },
    async (args) => {
      const kind = args.kind as PresetKind;
      const r = await savePreset({
        id: typeof args.id === "string" ? args.id : undefined,
        kind,
        name: String(args.name ?? ""),
        data: args.data,
      });
      return jsonToolResult(r, !r.ok);
    },
  );

  s.tool(
    "delete_preset",
    "Delete a local preset by id.",
    { id: z.string().uuid() },
    async (args) => {
      const r = await deletePreset({ id: String(args.id ?? "") });
      return jsonToolResult(r, !r.ok);
    },
  );
}
