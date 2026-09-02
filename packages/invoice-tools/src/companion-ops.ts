import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import {
  bankTransactions,
  clients,
  confirmPaymentMatchProposal,
  ensureClient,
  getWorkspaceEntitlements,
  getWorkspaceName,
  invoices,
  issuerBusinesses,
  paymentMatchProposals,
  rejectPaymentMatchProposal,
  tryCreateDbFromEnv,
  type InvoiceyDb,
} from "@invoicey/db";
import {
  ClientSnapshotSchema,
  IcoSchema,
  type Invoice,
} from "@invoicey/invoice-core/schema";
import {
  resolveDisplayStatus,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";

import {
  CompanionRequestSchema,
  type CompanionRequest,
} from "./companion-schema";

export {
  CompanionRequestSchema,
  type CompanionRequest,
} from "./companion-schema";
import {
  createAndRenderInvoice,
  lookupBusiness,
  searchBusiness,
} from "./handlers";
import {
  cancelInvoiceById,
  getInvoice,
  issueInvoiceById,
  listInvoices,
  markInvoicePaidById,
  type InvoiceSummary,
  unmarkInvoicePaidById,
} from "./invoice-ops";
import { looksLikeUuid, sanitizeSearch } from "./invoice-ref";
import {
  sendInvoiceEmailById,
  sendPaymentReceivedEmailIfEnabled,
} from "./send-invoice-email";
import {
  getInvoiceyRequestContext,
  resolveWorkspaceId,
} from "./workspace-context";

export type CompanionOk<T> = { ok: true } & T;
export type CompanionErr = {
  ok: false;
  error: string;
  issues?: unknown;
};
export type CompanionResult =
  | CompanionOk<Record<string, unknown>>
  | CompanionErr;

type InvoiceRow = typeof invoices.$inferSelect;

function requireDb(): InvoiceyDb {
  const database = tryCreateDbFromEnv();
  if (!database) {
    throw new Error("DATABASE_URL is not set");
  }
  return database;
}

function pragueTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fail(error: string): CompanionErr {
  return { ok: false, error };
}

/** Resolve an invoice row by UUID or issued number in the ALS workspace. */
export async function loadInvoiceRowByRef(
  ref: string,
): Promise<{ ok: true; row: InvoiceRow } | { ok: false; error: string }> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId();
  const trimmed = ref.trim();
  if (!trimmed) {
    return fail("invoice ref is required");
  }
  if (looksLikeUuid(trimmed)) {
    const rows = await database
      .select()
      .from(invoices)
      .where(
        and(eq(invoices.id, trimmed), eq(invoices.workspaceId, workspaceId)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return fail(`invoice not found: ${trimmed}`);
    return { ok: true, row };
  }
  const rows = await database
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.number, trimmed), eq(invoices.workspaceId, workspaceId)),
    )
    .limit(5);
  if (rows.length === 0) return fail(`invoice not found: ${trimmed}`);
  if (rows.length > 1) {
    return fail(`ambiguous number ${trimmed} — pass the invoice id instead`);
  }
  const row = rows[0];
  if (!row) return fail(`invoice not found: ${trimmed}`);
  return { ok: true, row };
}

async function requireInvoiceId(
  ref: string,
): Promise<{ ok: true; id: string } | CompanionErr> {
  const loaded = await loadInvoiceRowByRef(ref);
  if (!loaded.ok) return loaded;
  return { ok: true, id: loaded.row.id };
}

async function companionMe(): Promise<CompanionResult> {
  const ctx = getInvoiceyRequestContext();
  if (!ctx?.workspaceId) return fail("workspace context missing");
  const database = requireDb();
  const workspaceName = await getWorkspaceName(database, ctx.workspaceId);
  return {
    ok: true,
    kind: ctx.userId ? "user" : "ops",
    userId: ctx.userId ?? null,
    workspaceId: ctx.workspaceId,
    workspaceName,
  };
}

async function companionStatus(): Promise<CompanionResult> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId();
  const todayIso = pragueTodayIso();
  const rows = await database
    .select({
      display: {
        issuedAt: invoices.issuedAt,
        dueDate: invoices.dueDate,
        paidAt: invoices.paidAt,
        cancelledAt: invoices.cancelledAt,
        issueDate: invoices.issueDate,
      },
      total: invoices.total,
      paidAmount: invoices.paidAmount,
      currency: invoices.currency,
    })
    .from(invoices)
    .where(eq(invoices.workspaceId, workspaceId));

  const counts: Record<InvoiceDisplayStatus, number> = {
    draft: 0,
    unpaid: 0,
    overdue: 0,
    paid: 0,
    future: 0,
    cancelled: 0,
  };
  const outstanding: Record<string, number> = {};
  for (const row of rows) {
    const status = resolveDisplayStatus(row.display, todayIso);
    counts[status] += 1;
    if (status === "unpaid" || status === "overdue" || status === "future") {
      const left = Math.max(
        0,
        Math.abs(Number(row.total) || 0) - Number(row.paidAmount),
      );
      const code = row.currency || "CZK";
      outstanding[code] = (outstanding[code] ?? 0) + left;
    }
  }
  return { ok: true, counts, outstanding, invoiceCount: rows.length };
}

async function companionInvoiceList(
  input: Extract<CompanionRequest, { op: "invoices.list" }>,
): Promise<CompanionResult> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId();
  const q = input.q ? sanitizeSearch(input.q) : "";
  if (!q) {
    const invoicesList = await listInvoices({
      workspaceId,
      limit: input.limit,
      unpaidOnly: input.unpaidOnly,
    });
    return { ok: true, invoices: invoicesList };
  }
  const limit = input.limit ?? 25;
  const conditions = [eq(invoices.workspaceId, workspaceId)];
  if (input.unpaidOnly) {
    conditions.push(sql`${invoices.issuedAt} is not null`);
    conditions.push(isNull(invoices.paidAt));
    conditions.push(isNull(invoices.cancelledAt));
  }
  const pattern = `%${q}%`;
  const search = looksLikeUuid(q)
    ? eq(invoices.id, q)
    : or(eq(invoices.number, q), ilike(invoices.clientName, pattern));
  if (search) conditions.push(search);
  const rows = await database
    .select()
    .from(invoices)
    .where(and(...conditions))
    .orderBy(desc(invoices.updatedAt))
    .limit(limit);
  const invoicesOut: InvoiceSummary[] = [];
  for (const row of rows) {
    const one = await getInvoice({ id: row.id, workspaceId });
    if (one.ok) invoicesOut.push(one.summary);
  }
  return { ok: true, invoices: invoicesOut };
}

async function companionInvoiceGet(ref: string): Promise<CompanionResult> {
  const resolved = await requireInvoiceId(ref);
  if (!resolved.ok) return resolved;
  const loaded = await getInvoice({ id: resolved.id });
  if (!loaded.ok) return fail(loaded.error);
  return {
    ok: true,
    summary: loaded.summary,
    invoice: loaded.invoice,
  };
}

async function loadClientSnapshot(
  database: InvoiceyDb,
  workspaceId: string,
  clientId: string,
): Promise<{ ok: true; snapshot: Invoice["client"] } | CompanionErr> {
  const [row] = await database
    .select({ snapshot: clients.snapshot })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.workspaceId, workspaceId)))
    .limit(1);
  if (!row) return fail(`client not found: ${clientId}`);
  const parsed = ClientSnapshotSchema.safeParse({
    ...row.snapshot,
    id: clientId,
  });
  if (!parsed.success) return fail("client snapshot failed validation");
  return { ok: true, snapshot: parsed.data };
}

async function addClientFromIco(icoInput: string): Promise<
  | {
      ok: true;
      clientId: string;
      snapshot: Invoice["client"];
      existing: boolean;
    }
  | CompanionErr
> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId();
  const entitlements = await getWorkspaceEntitlements(database, workspaceId);
  if (entitlements?.entitlements.clients.createMode === "managed") {
    return fail("clients are managed by the workspace plan");
  }
  const parsedIco = IcoSchema.safeParse(icoInput.replaceAll(/\s/g, ""));
  if (!parsedIco.success) return fail("invalid_ico");
  const lookup = await lookupBusiness(parsedIco.data);
  if (!lookup.ok) {
    return fail(lookup.message ?? "ares_failed");
  }
  const preferredId = crypto.randomUUID();
  const parsedSnapshot = ClientSnapshotSchema.safeParse({
    id: preferredId,
    ...lookup.draft,
  });
  if (!parsedSnapshot.success) return fail("ares_failed");
  const clientId = await ensureClient(
    database,
    workspaceId,
    /** SAFETY: ClientSnapshot is a JSON snapshot; ensureClient stores the record. */
    parsedSnapshot.data as Record<string, unknown>,
    { preferredId, source: "ares" },
  );
  return {
    ok: true,
    clientId,
    snapshot: { ...parsedSnapshot.data, id: clientId },
    existing: clientId !== preferredId,
  };
}

async function companionInvoiceCreate(
  input: Extract<CompanionRequest, { op: "invoices.create" }>,
): Promise<CompanionResult> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId();
  let client: Invoice["client"] | undefined;
  if (input.clientId) {
    const loaded = await loadClientSnapshot(
      database,
      workspaceId,
      input.clientId,
    );
    if (!loaded.ok) return loaded;
    client = loaded.snapshot;
  } else if (input.ico) {
    const added = await addClientFromIco(input.ico);
    if (!added.ok) return added;
    client = added.snapshot;
  }
  if (!client) return fail("clientId or ico is required");
  const created = await createAndRenderInvoice({
    draft: {
      client,
      items: input.draft.items,
      meta: input.draft.meta ?? { docType: "invoice" },
      vat: input.draft.vat,
      vatPreset: input.draft.vatPreset,
      payment: input.draft.payment ?? { method: "transfer" },
      pricesIncludeVat: input.draft.pricesIncludeVat,
    },
  });
  if (!created.ok) {
    if ("issues" in created) {
      return { ok: false, error: "validation_failed", issues: created.issues };
    }
    return fail(created.error);
  }
  let summary: InvoiceSummary | null = null;
  if (created.invoiceId) {
    const loaded = await getInvoice({ id: created.invoiceId });
    if (loaded.ok) summary = loaded.summary;
  }
  return {
    ok: true,
    invoiceId: created.invoiceId ?? null,
    number: created.invoice.meta.number,
    assumptions: created.assumptions,
    summary,
  };
}

async function companionSend(
  input: Extract<CompanionRequest, { op: "invoices.send" }>,
): Promise<CompanionResult> {
  const resolved = await requireInvoiceId(input.ref);
  if (!resolved.ok) return resolved;
  const sent = await sendInvoiceEmailById({
    id: resolved.id,
    to: input.to,
    cc: input.cc,
    coverText: input.coverText,
    subject: input.subject,
    attachIsdoc: input.attachIsdoc,
  });
  if (!sent.ok) return fail(sent.error);
  return sent;
}

async function mutateByRef(
  ref: string,
  fn: (
    id: string,
  ) => Promise<
    { ok: true; summary: InvoiceSummary } | { ok: false; error: string }
  >,
): Promise<CompanionResult> {
  const resolved = await requireInvoiceId(ref);
  if (!resolved.ok) return resolved;
  const result = await fn(resolved.id);
  if (!result.ok) return fail(result.error);
  return { ok: true, summary: result.summary };
}

async function companionClients(): Promise<CompanionResult> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId();
  const rows = await database
    .select({ id: clients.id, snapshot: clients.snapshot })
    .from(clients)
    .where(eq(clients.workspaceId, workspaceId))
    .orderBy(desc(clients.updatedAt))
    .limit(200);
  const out: Array<{
    id: string;
    name: string;
    ico: string | null;
    city: string | null;
  }> = [];
  for (const row of rows) {
    const parsed = ClientSnapshotSchema.safeParse({
      ...row.snapshot,
      id: row.id,
    });
    if (!parsed.success) continue;
    out.push({
      id: parsed.data.id,
      name: parsed.data.name,
      ico: parsed.data.ico ?? null,
      city: parsed.data.address.city,
    });
  }
  return { ok: true, clients: out };
}

async function companionIssuers(): Promise<CompanionResult> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId();
  const rows = await database
    .select({
      id: issuerBusinesses.id,
      isDefault: issuerBusinesses.isDefault,
      snapshot: issuerBusinesses.snapshot,
    })
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId));
  const out: Array<{
    id: string;
    isDefault: boolean;
    name: string;
    ico: string;
  }> = [];
  for (const row of rows) {
    const name =
      typeof row.snapshot.name === "string" ? row.snapshot.name : row.id;
    const ico = typeof row.snapshot.ico === "string" ? row.snapshot.ico : "";
    out.push({ id: row.id, isDefault: row.isDefault, name, ico });
  }
  return { ok: true, issuers: out };
}

async function companionProposals(): Promise<CompanionResult> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId();
  const rows = await database
    .select({
      id: paymentMatchProposals.id,
      amount: paymentMatchProposals.proposedAmount,
      score: paymentMatchProposals.score,
      confidence: paymentMatchProposals.confidence,
      reasons: paymentMatchProposals.reasonCodes,
      blockers: paymentMatchProposals.blockerCodes,
      transactionAmount: bankTransactions.amount,
      bookedDate: bankTransactions.bookedDate,
      variableSymbol: bankTransactions.variableSymbol,
      counterpartyName: bankTransactions.counterpartyName,
      invoiceId: invoices.id,
      invoiceNumber: invoices.number,
      clientName: invoices.clientName,
      currency: invoices.currency,
    })
    .from(paymentMatchProposals)
    .innerJoin(
      bankTransactions,
      eq(bankTransactions.id, paymentMatchProposals.bankTransactionId),
    )
    .innerJoin(invoices, eq(invoices.id, paymentMatchProposals.invoiceId))
    .where(
      and(
        eq(paymentMatchProposals.workspaceId, workspaceId),
        eq(paymentMatchProposals.status, "pending"),
      ),
    )
    .orderBy(
      desc(paymentMatchProposals.score),
      desc(bankTransactions.bookedDate),
    );
  return { ok: true, proposals: rows };
}

async function companionConfirm(proposalId: string): Promise<CompanionResult> {
  const database = requireDb();
  const workspaceId = resolveWorkspaceId();
  const ctx = getInvoiceyRequestContext();
  const result = await confirmPaymentMatchProposal({
    workspaceId,
    proposalId,
    actorUserId: ctx?.userId,
    actorType: ctx?.userId ? "user" : "system",
  });
  if (!result.ok) return fail(result.error);
  if (result.becamePaid) {
    try {
      await sendPaymentReceivedEmailIfEnabled({
        db: database,
        workspaceId,
        invoiceId: result.invoiceId,
      });
    } catch {
      /** email must not fail the confirm */
    }
  }
  return result;
}

async function companionReject(proposalId: string): Promise<CompanionResult> {
  const ctx = getInvoiceyRequestContext();
  if (!ctx?.userId) {
    return fail("payments.reject requires a user API key");
  }
  const rejected = await rejectPaymentMatchProposal({
    workspaceId: resolveWorkspaceId(),
    proposalId,
    actorUserId: ctx.userId,
  });
  if (!rejected) return fail("proposal_not_found");
  return { ok: true, rejected: true };
}

async function dispatchInvoices(
  req: Extract<CompanionRequest, { op: `invoices.${string}` }>,
): Promise<CompanionResult> {
  switch (req.op) {
    case "invoices.list":
      return companionInvoiceList(req);
    case "invoices.get":
      return companionInvoiceGet(req.ref);
    case "invoices.create":
      return companionInvoiceCreate(req);
    case "invoices.issue":
      return mutateByRef(req.ref, (id) => issueInvoiceById({ id }));
    case "invoices.send":
      return companionSend(req);
    case "invoices.paid":
      return mutateByRef(req.ref, (id) => markInvoicePaidById({ id }));
    case "invoices.unpaid":
      return mutateByRef(req.ref, (id) => unmarkInvoicePaidById({ id }));
    case "invoices.cancel":
      return mutateByRef(req.ref, (id) => cancelInvoiceById({ id }));
    default: {
      const _never: never = req;
      return fail(`unsupported op: ${String(_never)}`);
    }
  }
}

async function dispatchOther(req: CompanionRequest): Promise<CompanionResult> {
  switch (req.op) {
    case "me":
      return companionMe();
    case "status":
      return companionStatus();
    case "clients.list":
      return companionClients();
    case "clients.add":
      return addClientFromIco(req.ico);
    case "issuers.list":
      return companionIssuers();
    case "payments.proposals":
      return companionProposals();
    case "payments.confirm":
      return companionConfirm(req.proposalId);
    case "payments.reject":
      return companionReject(req.proposalId);
    case "ares.lookup": {
      const r = await lookupBusiness(req.ico);
      if (r.ok === false) return fail(r.message);
      return { ok: true, draft: r.draft };
    }
    case "ares.search": {
      const r = await searchBusiness(req.query, { limit: req.limit });
      if (r.ok === false) return fail(r.message);
      return {
        ok: true,
        query: r.query,
        total: r.total,
        matches: r.matches,
      };
    }
    default:
      return dispatchInvoices(req);
  }
}

/**
 * Dispatch a companion JSON operation. Caller must already be inside
 * invoicey ALS workspace context.
 */
export async function runCompanionOp(input: unknown): Promise<CompanionResult> {
  const parsed = CompanionRequestSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message ?? "invalid_request");
  }
  return dispatchOther(parsed.data);
}
