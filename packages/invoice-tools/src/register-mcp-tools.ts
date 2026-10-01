import { z } from "zod";

import {
  WorkspaceFrozenError,
  assertWorkspaceWritable,
  tryCreateDbFromEnv,
} from "@invoicey/db";

import { runCompanionOp } from "./companion-ops";
import {
  createAndRenderInvoice,
  lookupBusiness,
  searchBusiness,
  updateDraftInvoice,
} from "./handlers";
import {
  getInvoice,
  issueInvoiceById,
  listInvoices,
  markInvoicePaidById,
  resolveDefaultIssuer,
} from "./invoice-ops";
import { McpDraftSchema, McpDraftPatchSchema } from "./mcp-draft-schema";
import { jsonToolResult } from "./mcp-json-result";
import { mcpToolPolicy } from "./mcp-policy";
import {
  deletePreset,
  getPreset,
  listPresets,
  savePreset,
  type PresetKind,
} from "./presets";
import { sendInvoiceEmailById } from "./send-invoice-email";
import { resolveWorkspaceId } from "./workspace-context";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolRequest,
  CallToolResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const presetKindSchema = z.enum(["issuer", "invoice_template"]);
const jsonObjectSchema = z.record(z.string(), z.any());

type ToolResult = ReturnType<typeof jsonToolResult> &
  Pick<CallToolResult, "_meta">;
type ToolArguments = NonNullable<CallToolRequest["params"]["arguments"]>;
type ToolMetadata = NonNullable<Tool["_meta"]>;

export type RegisterInvoiceyMcpToolsOptions = {
  resultMeta?: ToolMetadata;
  authErrorMeta?: (error: string) => ToolMetadata;
  authorize?: (toolName: string) => Promise<string | null>;
  toolMeta?: (toolName: string) => ToolMetadata;

  /** Fired after each tool completes (success or error). Used for MCP activity metering. */
  onToolCall?: (info: {
    toolName: string;
    isError: boolean;
  }) => void | Promise<void>;
};

const WRITE_TOOLS = new Set([
  "create_invoice",
  "update_invoice_draft",
  "mark_invoice_paid",
  "issue_invoice",
  "send_invoice_email",
  "save_preset",
  "delete_preset",
]);

async function rejectFrozenWrite(toolName: string): Promise<ToolResult | null> {
  if (!WRITE_TOOLS.has(toolName)) return null;
  const database = tryCreateDbFromEnv();
  if (!database) return null;
  try {
    await assertWorkspaceWritable(database, resolveWorkspaceId());
    return null;
  } catch (error) {
    if (error instanceof WorkspaceFrozenError) {
      return jsonToolResult(
        { ok: false as const, error: "workspace_frozen" },
        true,
      );
    }
    throw error;
  }
}

/** Registers Plan 12a tools on an MCP server (stdio or HTTP). */
export function registerInvoiceyMcpTools(
  server: McpServer,
  options?: RegisterInvoiceyMcpToolsOptions,
): void {
  const s = {
    tool(
      name: string,
      description: string,
      schema: Record<string, z.ZodTypeAny>,
      handler: (args: ToolArguments) => Promise<ToolResult>,
    ) {
      const policy = mcpToolPolicy(name);
      // SAFETY: registerTool accepts these Zod schemas and CallToolResult-compatible handlers; narrowing avoids recursive Zod 3/4 inference.
      const register = server.registerTool.bind(server) as (
        name: string,
        config: {
          title: string;
          description: string;
          inputSchema: Record<string, z.ZodTypeAny>;
          annotations: ReturnType<typeof mcpToolPolicy>["annotations"];
          _meta: ToolMetadata;
        },
        handler: (args: ToolArguments) => Promise<ToolResult>,
      ) => ReturnType<McpServer["registerTool"]>;
      register(
        name,
        {
          title: name
            .split("_")
            .map((word) => word[0].toUpperCase() + word.slice(1))
            .join(" "),
          description,
          inputSchema: schema,
          annotations: policy.annotations,
          _meta: {
            securitySchemes: [{ type: "oauth2", scopes: [policy.scope] }],
            ...options?.toolMeta?.(name),
          },
        },
        handler,
      );
    },
  };
  const onToolCall = options?.onToolCall;

  const wrap = (
    toolName: string,
    handler: (args: ToolArguments) => Promise<ToolResult>,
  ) => {
    return async (args: ToolArguments): Promise<ToolResult> => {
      const denied = await options?.authorize?.(toolName);
      if (denied)
        return {
          ...jsonToolResult({ ok: false, error: denied }, true),
          _meta: options?.authErrorMeta?.(denied),
        };
      const frozen = await rejectFrozenWrite(toolName);
      const result = frozen ?? (await handler(args));
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
      return { ...result, _meta: options?.resultMeta };
    };
  };

  s.tool(
    "lookup_business",
    "Look up a Czech economic subject by IČO (8 digits) via ARES. Returns draft client fields (no `id`). Prefer this once IČO is known.",
    {
      ico: z
        .string()
        .regex(/^\d{8}$/)
        .describe("Eight-digit IČO"),
    },
    wrap("lookup_business", async (args) => {
      const ico = z.string().parse(args.ico);
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
      const query = z.string().parse(args.query);
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
    "Assemble a draft invoice, validate against InvoiceSchema, and render PDF + ISDOC. Issuer is locked to the workspace default (do not pass issuer or preset ids).",
    {
      draft: McpDraftSchema.describe(
        "Invoice facts explicitly provided or confirmed by the user. Ask for missing fields. Seller and bank account come from the connected workspace; invoice number is assigned on issue.",
      ),
    },
    wrap("create_invoice", async (args) => {
      const issuer = await resolveDefaultIssuer();
      if (!issuer) {
        return jsonToolResult(
          {
            ok: false as const,
            error:
              "no issuer in this workspace — create one in Invoicey before drafting",
          },
          true,
        );
      }
      const r = await createAndRenderInvoice({
        draft: args.draft,
        issuer,
      });
      if (!r.ok) return jsonToolResult(r, true);
      return jsonToolResult({
        ok: true,
        invoice: r.invoice,
        invoiceId: r.invoiceId,
        assumptions: r.assumptions,
      });
    }),
  );

  s.tool(
    "get_workspace",
    "Get the connected workspace's default issuer and bank details before drafting. Ask the user to confirm missing invoice facts; never invent identifiers.",
    {},
    wrap("get_workspace", async () => {
      return jsonToolResult({
        ok: true,
        workspaceId: resolveWorkspaceId(),
        issuer: await resolveDefaultIssuer(),
      });
    }),
  );

  s.tool(
    "update_invoice_draft",
    "Update a saved draft and recalculate totals. Read get_invoice first; supply only confirmed changed fields. The seller stays locked. Issued invoices cannot be edited.",
    {
      id: z.string().uuid(),
      patch: McpDraftPatchSchema,
    },
    wrap("update_invoice_draft", async (args) => {
      const r = await updateDraftInvoice({
        id: z.string().parse(args.id),
        patch: McpDraftPatchSchema.parse(args.patch),
      });
      return jsonToolResult(r, !r.ok);
    }),
  );
  s.tool(
    "list_clients",
    "List saved clients in this workspace before choosing an invoice recipient. Returns up to 200 client summaries; use ARES lookup for complete Czech business details.",
    {},
    wrap("list_clients", async () =>
      jsonToolResult(await runCompanionOp({ op: "clients.list" })),
    ),
  );

  s.tool(
    "list_invoices",
    "List workspace invoices from Neon (requires INVOICEY_DATABASE_URL). Returns summaries with domain status + displayStatus.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max rows (default 25)"),
      query: z
        .string()
        .max(200)
        .optional()
        .describe("Invoice number or client name"),
      offset: z.number().int().min(0).max(100000).optional(),
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
        const unpaidOnly = z.boolean().optional().parse(args.unpaidOnly);
        const offset = z.number().default(0).parse(args.offset);
        const pageSize = limit ?? 25;
        const rows = await listInvoices({
          limit: pageSize + 1,
          unpaidOnly,
          offset,
          query: z.string().optional().parse(args.query),
        });
        return jsonToolResult({
          ok: true as const,
          invoices: rows.slice(0, pageSize),
          nextOffset: rows.length > pageSize ? offset + pageSize : null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonToolResult({ ok: false as const, error: message }, true);
      }
    }),
  );

  s.tool(
    "get_invoice",
    "Get one invoice by id from Neon (requires INVOICEY_DATABASE_URL). Includes summary with status/displayStatus and validated payload when present.",
    { id: z.string().uuid().describe("Invoice row id") },
    wrap("get_invoice", async (args) => {
      try {
        const r = await getInvoice({ id: z.string().parse(args.id) });
        return jsonToolResult(r, !r.ok);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonToolResult({ ok: false as const, error: message }, true);
      }
    }),
  );

  s.tool(
    "mark_invoice_paid",
    "Mark an issued unpaid invoice as paid (requires INVOICEY_DATABASE_URL). Sets paidAt.",
    { id: z.string().uuid().describe("Invoice row id") },
    wrap("mark_invoice_paid", async (args) => {
      try {
        const r = await markInvoicePaidById({ id: z.string().parse(args.id) });
        return jsonToolResult(r, !r.ok);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonToolResult({ ok: false as const, error: message }, true);
      }
    }),
  );

  s.tool(
    "issue_invoice",
    "Issue a draft invoice (atomic numbering). Requires INVOICEY_DATABASE_URL. Idempotent if already issued.",
    { id: z.string().uuid().describe("Draft invoice id") },
    wrap("issue_invoice", async (args) => {
      try {
        const r = await issueInvoiceById({ id: z.string().parse(args.id) });
        return jsonToolResult(r, !r.ok);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonToolResult({ ok: false as const, error: message }, true);
      }
    }),
  );

  s.tool(
    "send_invoice_email",
    "Email an issued invoice (PDF + optional ISDOC) via the configured email transport. Requires INVOICEY_DATABASE_URL and a configured transport (Resend today). Pass `to` when the client has no contactEmail — do not invent an address.",
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
          id: z.string().parse(args.id),
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
    "List saved issuer and invoice template presets in the connected workspace.",
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
      const r = await getPreset({ id: z.string().parse(args.id) });
      return jsonToolResult(r, !r.ok);
    }),
  );

  s.tool(
    "save_preset",
    "Create or update a workspace preset (issuer snapshot or invoice_template draft).",
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
        name: z.string().parse(args.name),
        data: args.data,
      });
      return jsonToolResult(r, !r.ok);
    }),
  );

  s.tool(
    "delete_preset",
    "Delete a workspace preset by id.",
    { id: z.string().uuid() },
    wrap("delete_preset", async (args) => {
      const r = await deletePreset({ id: z.string().parse(args.id) });
      return jsonToolResult(r, !r.ok);
    }),
  );
}
