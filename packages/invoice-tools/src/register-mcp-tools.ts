import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  createAndRenderInvoice,
  lookupBusiness,
  searchBusiness,
} from "./handlers";
import { getInvoice, listInvoices, markInvoicePaidById } from "./invoice-ops";
import { jsonToolResult } from "./mcp-json-result";
import {
  deletePreset,
  getPreset,
  listPresets,
  savePreset,
  type PresetKind,
} from "./presets";
import { sendInvoiceEmailById } from "./send-invoice-email";

const presetKindSchema = z.enum(["issuer", "invoice_template"]);
const jsonObjectSchema = z.record(z.string(), z.any());

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** Narrowed registrar — full McpServer.tool() generics blow TS instantiation depth. */
type ToolRegistrar = {
  tool: (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: Record<string, unknown>) => Promise<ToolResult>,
  ) => unknown;
};

export type RegisterInvoiceyMcpToolsOptions = {
  /** Fired after each tool completes (success or error). Used for MCP activity metering. */
  onToolCall?: (info: {
    toolName: string;
    isError: boolean;
  }) => void | Promise<void>;
};

/** Registers Plan 12a tools on an MCP server (stdio or HTTP). */
export function registerInvoiceyMcpTools(
  server: McpServer,
  options?: RegisterInvoiceyMcpToolsOptions,
): void {
  const s = server as unknown as ToolRegistrar;
  const onToolCall = options?.onToolCall;

  const wrap = (
    toolName: string,
    handler: (args: Record<string, unknown>) => Promise<ToolResult>,
  ) => {
    return async (args: Record<string, unknown>): Promise<ToolResult> => {
      const result = await handler(args);
      if (onToolCall) {
        try {
          await onToolCall({
            toolName,
            isError: result.isError === true,
          });
        } catch {
          /** metering must not break tools */
        }
      }
      return result;
    };
  };

  s.tool(
    "lookup_business",
    "Look up a Czech economic subject by IČO (8 digits) via ARES. Returns draft client fields (no `id`). Prefer this once IČO is known.",
    { ico: z.string().describe("Eight-digit IČO") },
    wrap("lookup_business", async (args) => {
      const ico = String(args.ico ?? "");
      const r = await lookupBusiness(ico);
      return jsonToolResult(r, !r.ok);
    }),
  );

  s.tool(
    "search_business",
    "Search Czech economic subjects by company name (obchodní jméno) via ARES. Returns matches with IČO + structured address when available. Then call lookup_business with the chosen IČO.",
    {
      query: z.string().describe("Company name fragment, e.g. NFCtron a.s."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Max matches (default 5)"),
    },
    wrap("search_business", async (args) => {
      const query = String(args.query ?? "");
      const limit =
        typeof args.limit === "number" && Number.isFinite(args.limit)
          ? args.limit
          : undefined;
      const r = await searchBusiness(query, { limit });
      return jsonToolResult(r, !r.ok);
    }),
  );

  s.tool(
    "create_invoice",
    "Assemble a draft invoice (optional issuer/template presets), validate against InvoiceSchema, and render PDF + ISDOC. Issuer is locked server-side.",
    {
      draft: jsonObjectSchema
        .optional()
        .describe(
          'Partial invoice draft (issuer ignored — locked server-side). Required: meta, client, payment, items. Optional meta.language: `cs` | `en` (PDF/ISDOC labels; omitted → cs). VAT: prefer top-level `vat: { mode, suppliesAbroad }` OR high-level `vatPreset` (`neplatce`|`regular`|`reverse_charge`|`oss`) which invents `{ mode, suppliesAbroad: "none" }` when `vat` is missing. Line amounts are stored exclusive: `unitPriceWithoutVat` + line `vatRate`. Set `pricesIncludeVat: true` if spoken/unit prices include VAT — normalizer converts to exclusive using line vatRate (0 for reverse_charge / neplátce). Do not invent legalNote or localReverseChargeCode; reverse_charge fails without localReverseChargeCode. Domestic default: vat `{ mode: "regular", suppliesAbroad: "none" }` with vatRate 21 (or 0 if issuer is non–VAT-payer).',
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
    wrap("create_invoice", async (args) => {
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
    }),
  );

  s.tool(
    "list_invoices",
    "List workspace invoices from Neon (requires DATABASE_URL). Returns summaries with domain status + displayStatus.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max rows (default 25)"),
      unpaidOnly: z
        .boolean()
        .optional()
        .describe("Only open issued invoices (unpaid / overdue / future)"),
    },
    wrap("list_invoices", async (args) => {
      try {
        const limit =
          typeof args.limit === "number" && Number.isFinite(args.limit)
            ? args.limit
            : undefined;
        const unpaidOnly =
          typeof args.unpaidOnly === "boolean" ? args.unpaidOnly : undefined;
        const rows = await listInvoices({ limit, unpaidOnly });
        return jsonToolResult({ ok: true as const, invoices: rows });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonToolResult({ ok: false as const, error: message }, true);
      }
    }),
  );

  s.tool(
    "get_invoice",
    "Get one invoice by id from Neon (requires DATABASE_URL). Includes summary with status/displayStatus and validated payload when present.",
    { id: z.string().uuid().describe("Invoice row id") },
    wrap("get_invoice", async (args) => {
      try {
        const r = await getInvoice({ id: String(args.id ?? "") });
        return jsonToolResult(r, !r.ok);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonToolResult({ ok: false as const, error: message }, true);
      }
    }),
  );

  s.tool(
    "mark_invoice_paid",
    "Mark an issued unpaid invoice as paid (requires DATABASE_URL). Sets paidAt.",
    { id: z.string().uuid().describe("Invoice row id") },
    wrap("mark_invoice_paid", async (args) => {
      try {
        const r = await markInvoicePaidById({ id: String(args.id ?? "") });
        return jsonToolResult(r, !r.ok);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonToolResult({ ok: false as const, error: message }, true);
      }
    }),
  );

  s.tool(
    "send_invoice_email",
    "Email an issued invoice (PDF + optional ISDOC) via Resend. Requires DATABASE_URL + RESEND_API_KEY. Pass `to` when the client has no contactEmail — do not invent an address.",
    {
      id: z.string().uuid().describe("Invoice row id"),
      to: z
        .string()
        .email()
        .optional()
        .describe("Recipient; defaults to client.contactEmail when set"),
      cc: z
        .array(z.string().email())
        .optional()
        .describe("Optional CC recipients"),
      coverText: z.string().optional().describe("Custom cover body"),
      attachIsdoc: z
        .boolean()
        .optional()
        .describe("Attach ISDOC (default from issuer settings / true)"),
      subject: z.string().optional(),
    },
    wrap("send_invoice_email", async (args) => {
      try {
        const r = await sendInvoiceEmailById({
          id: String(args.id ?? ""),
          to: typeof args.to === "string" ? args.to : undefined,
          cc: Array.isArray(args.cc)
            ? args.cc.filter((x): x is string => typeof x === "string")
            : undefined,
          coverText:
            typeof args.coverText === "string" ? args.coverText : undefined,
          subject: typeof args.subject === "string" ? args.subject : undefined,
          attachIsdoc:
            typeof args.attachIsdoc === "boolean"
              ? args.attachIsdoc
              : undefined,
        });
        return jsonToolResult(r, !r.ok);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonToolResult({ ok: false as const, error: message }, true);
      }
    }),
  );

  s.tool(
    "list_presets",
    "List locally saved issuer and invoice_template presets.",
    {
      kind: presetKindSchema
        .optional()
        .describe("Filter by issuer or invoice_template"),
    },
    wrap("list_presets", async (args) => {
      const kind =
        args.kind === "issuer" || args.kind === "invoice_template"
          ? (args.kind as PresetKind)
          : undefined;
      const r = await listPresets({ kind });
      return jsonToolResult(r);
    }),
  );

  s.tool(
    "get_preset",
    "Get one preset by id.",
    { id: z.string().uuid() },
    wrap("get_preset", async (args) => {
      const r = await getPreset({ id: String(args.id ?? "") });
      return jsonToolResult(r, !r.ok);
    }),
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
    wrap("save_preset", async (args) => {
      const kind = args.kind as PresetKind;
      const r = await savePreset({
        id: typeof args.id === "string" ? args.id : undefined,
        kind,
        name: String(args.name ?? ""),
        data: args.data,
      });
      return jsonToolResult(r, !r.ok);
    }),
  );

  s.tool(
    "delete_preset",
    "Delete a local preset by id.",
    { id: z.string().uuid() },
    wrap("delete_preset", async (args) => {
      const r = await deletePreset({ id: String(args.id ?? "") });
      return jsonToolResult(r, !r.ok);
    }),
  );
}
