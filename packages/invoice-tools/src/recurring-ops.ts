import {
  clients,
  invoiceItems,
  invoiceTemplates,
  invoices,
  issuerBusinesses,
  recurringSchedules,
  tryCreateDbFromEnv,
  type InvoiceyDb,
} from "@invoicey/db";
import {
  withDbTransaction,
  type DbTransaction,
} from "@invoicey/db/transaction";
import {
  ClientSnapshotSchema,
  InvoiceSchema,
  IssuerSnapshotSchema,
  type Invoice,
} from "@invoicey/invoice-core/schema";
import { and, desc, eq, isNull, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  RecurringCadenceSchema,
  RecurringDayOfMonthSchema,
  advanceNextRunUntilFuture,
  buildRecurringDraft,
  defaultNextRunOn,
  paymentDueDays,
  type RecurringCadence,
} from "./recurring";
import { resolveWorkspaceId } from "./workspace-context";

type Db = InvoiceyDb | DbTransaction;

export type RecurringOpError = { ok: false; error: string };

export type RecurringListItem = {
  templateId: string;
  scheduleId: string;
  name: string;
  clientName: string;
  issuerName: string;
  cadence: RecurringCadence;
  dayOfMonth: number;
  nextRunOn: string;
  paused: boolean;
  lastRunOn: string | null;
  lastInvoiceId: string | null;
  paymentDueDays: number;
};

function requireDb(): InvoiceyDb {
  const database = tryCreateDbFromEnv();
  if (!database) {
    throw new Error("DATABASE_URL is not set");
  }
  return database;
}

function rowValuesFromInvoice(
  invoice: Invoice,
  opts: {
    id: string;
    workspaceId: string;
    issuerId: string;
    clientId: string;
    recurringScheduleId: string;
  },
) {
  return {
    id: opts.id,
    workspaceId: opts.workspaceId,
    issuerId: opts.issuerId,
    clientId: opts.clientId,
    docType: invoice.meta.docType,
    number: invoice.meta.number === "DRAFT" ? null : invoice.meta.number,
    issueDate: invoice.meta.issueDate,
    dueDate: invoice.meta.dueDate,
    duzp: invoice.meta.duzp,
    issuedAt: null,
    paidAt: null,
    cancelledAt: null,
    currency: invoice.meta.currency,
    total: String(invoice.totals.total),
    subtotal: String(invoice.totals.subtotal),
    vatTotal: String(invoice.totals.vatTotal),
    clientName: invoice.client.name,
    notes: invoice.notes ?? null,
    issuerSnapshot: invoice.issuer as unknown as Record<string, unknown>,
    clientSnapshot: invoice.client as unknown as Record<string, unknown>,
    payloadJson: invoice as unknown as Record<string, unknown>,
    recurringScheduleId: opts.recurringScheduleId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function insertDraftItems(
  db: Db,
  invoiceId: string,
  invoice: Invoice,
): Promise<void> {
  if (invoice.items.length === 0) {
    return;
  }
  await db.insert(invoiceItems).values(
    invoice.items.map((line) => ({
      id: randomUUID(),
      invoiceId,
      position: line.position,
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
      unitPriceWithoutVat: String(line.unitPriceWithoutVat),
      vatRate: String(line.vatRate),
      lineSubtotal: String(line.lineSubtotal),
      lineVat: String(line.lineVat),
      lineTotal: String(line.lineTotal),
    })),
  );
}

async function hasOpenDraft(
  db: Db,
  workspaceId: string,
  scheduleId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.workspaceId, workspaceId),
        eq(invoices.recurringScheduleId, scheduleId),
        isNull(invoices.issuedAt),
        isNull(invoices.cancelledAt),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}

async function loadLiveParties(
  db: Db,
  workspaceId: string,
  issuerId: string,
  clientId: string,
): Promise<
  | { ok: true; issuer: Invoice["issuer"]; client: Invoice["client"] }
  | RecurringOpError
> {
  const [issuerRow] = await db
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const [clientRow] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.workspaceId, workspaceId)))
    .limit(1);
  const issuer = issuerRow
    ? IssuerSnapshotSchema.safeParse(issuerRow.snapshot)
    : null;
  const client = clientRow
    ? ClientSnapshotSchema.safeParse(clientRow.snapshot)
    : null;
  if (!issuer?.success || !client?.success) {
    return { ok: false, error: "missing_parties" };
  }
  return { ok: true, issuer: issuer.data, client: client.data };
}

async function materializeFromTemplate(
  db: Db,
  input: {
    workspaceId: string;
    scheduleId: string;
    issuerId: string;
    clientId: string;
    payloadJson: Record<string, unknown>;
    paymentDueDays: number;
    todayIso: string;
  },
): Promise<{ ok: true; invoiceId: string } | RecurringOpError> {
  if (await hasOpenDraft(db, input.workspaceId, input.scheduleId)) {
    return { ok: false, error: "open_draft" };
  }
  const parsed = InvoiceSchema.safeParse(input.payloadJson);
  if (!parsed.success) {
    return { ok: false, error: "invalid_payload" };
  }
  const parties = await loadLiveParties(
    db,
    input.workspaceId,
    input.issuerId,
    input.clientId,
  );
  if (!parties.ok) {
    return parties;
  }
  const draft = buildRecurringDraft({
    template: parsed.data,
    issuer: parties.issuer,
    client: parties.client,
    todayIso: input.todayIso,
    paymentDueDays: input.paymentDueDays,
  });
  if (!draft.ok) {
    return draft;
  }
  const invoiceId = randomUUID();
  await db.insert(invoices).values(
    rowValuesFromInvoice(draft.invoice, {
      id: invoiceId,
      workspaceId: input.workspaceId,
      issuerId: input.issuerId,
      clientId: input.clientId,
      recurringScheduleId: input.scheduleId,
    }),
  );
  await insertDraftItems(db, invoiceId, draft.invoice);
  return { ok: true, invoiceId };
}

export async function createRecurringFromInvoice(options: {
  workspaceId: string;
  invoiceId: string;
  name: string;
  cadence: RecurringCadence;
  dayOfMonth: number;
  nextRunOn?: string;
  todayIso: string;
}): Promise<
  { ok: true; templateId: string; scheduleId: string } | RecurringOpError
> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  const name = options.name.trim();
  if (!name) {
    return { ok: false, error: "missing_name" };
  }
  const cadenceParsed = RecurringCadenceSchema.safeParse(options.cadence);
  const dayParsed = RecurringDayOfMonthSchema.safeParse(options.dayOfMonth);
  if (!cadenceParsed.success) {
    return { ok: false, error: "invalid_cadence" };
  }
  if (!dayParsed.success) {
    return { ok: false, error: "invalid_day" };
  }

  try {
    return await withDbTransaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, options.invoiceId),
            eq(invoices.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!row) {
        return { ok: false, error: "not_found" };
      }
      if (row.docType !== "invoice") {
        return { ok: false, error: "unsupported_doc_type" };
      }
      const payload = InvoiceSchema.safeParse(row.payloadJson);
      if (!payload.success) {
        return { ok: false, error: "invalid_payload" };
      }

      const [dup] = await tx
        .select({ id: invoiceTemplates.id })
        .from(invoiceTemplates)
        .where(
          and(
            eq(invoiceTemplates.workspaceId, workspaceId),
            eq(invoiceTemplates.name, name),
          ),
        )
        .limit(1);
      if (dup) {
        return { ok: false, error: "duplicate_name" };
      }

      const templateId = randomUUID();
      const scheduleId = randomUUID();
      const dueDays = paymentDueDays(row.issueDate, row.dueDate);
      const nextRunOn =
        options.nextRunOn?.trim() ||
        defaultNextRunOn(options.todayIso, dayParsed.data, cadenceParsed.data);

      await tx.insert(invoiceTemplates).values({
        id: templateId,
        workspaceId,
        issuerId: row.issuerId,
        clientId: row.clientId,
        name,
        docType: "invoice",
        paymentDueDays: dueDays,
        payloadJson: payload.data as unknown as Record<string, unknown>,
        sourceInvoiceId: row.id,
      });
      await tx.insert(recurringSchedules).values({
        id: scheduleId,
        workspaceId,
        templateId,
        cadence: cadenceParsed.data,
        dayOfMonth: dayParsed.data,
        nextRunOn,
        paused: 0,
      });
      return { ok: true, templateId, scheduleId };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("DATABASE_URL")) {
      return { ok: false, error: "DATABASE_URL is not set" };
    }
    return { ok: false, error: message };
  }
}

export async function listRecurring(options: {
  workspaceId: string;
}): Promise<RecurringListItem[]> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  const database = tryCreateDbFromEnv();
  if (!database) {
    return [];
  }
  const rows = await database
    .select({
      templateId: invoiceTemplates.id,
      scheduleId: recurringSchedules.id,
      name: invoiceTemplates.name,
      cadence: recurringSchedules.cadence,
      dayOfMonth: recurringSchedules.dayOfMonth,
      nextRunOn: recurringSchedules.nextRunOn,
      paused: recurringSchedules.paused,
      lastRunOn: recurringSchedules.lastRunOn,
      lastInvoiceId: recurringSchedules.lastInvoiceId,
      paymentDueDays: invoiceTemplates.paymentDueDays,
      issuerSnapshot: issuerBusinesses.snapshot,
      clientSnapshot: clients.snapshot,
    })
    .from(recurringSchedules)
    .innerJoin(
      invoiceTemplates,
      eq(recurringSchedules.templateId, invoiceTemplates.id),
    )
    .innerJoin(
      issuerBusinesses,
      eq(invoiceTemplates.issuerId, issuerBusinesses.id),
    )
    .innerJoin(clients, eq(invoiceTemplates.clientId, clients.id))
    .where(eq(recurringSchedules.workspaceId, workspaceId))
    .orderBy(desc(recurringSchedules.updatedAt));

  const items: RecurringListItem[] = [];
  for (const row of rows) {
    const cadence = RecurringCadenceSchema.safeParse(row.cadence);
    if (!cadence.success) {
      continue;
    }
    const issuer = IssuerSnapshotSchema.safeParse(row.issuerSnapshot);
    const client = ClientSnapshotSchema.safeParse(row.clientSnapshot);
    items.push({
      templateId: row.templateId,
      scheduleId: row.scheduleId,
      name: row.name,
      clientName: client.success ? client.data.name : "",
      issuerName: issuer.success ? issuer.data.name : "",
      cadence: cadence.data,
      dayOfMonth: row.dayOfMonth,
      nextRunOn: row.nextRunOn,
      paused: row.paused === 1,
      lastRunOn: row.lastRunOn,
      lastInvoiceId: row.lastInvoiceId,
      paymentDueDays: row.paymentDueDays,
    });
  }
  return items;
}

async function loadSchedule(
  db: Db,
  workspaceId: string,
  scheduleId: string,
  lock = false,
) {
  const query = db
    .select({
      schedule: recurringSchedules,
      template: invoiceTemplates,
    })
    .from(recurringSchedules)
    .innerJoin(
      invoiceTemplates,
      eq(recurringSchedules.templateId, invoiceTemplates.id),
    )
    .where(
      and(
        eq(recurringSchedules.id, scheduleId),
        eq(recurringSchedules.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

export async function pauseRecurringSchedule(options: {
  workspaceId: string;
  scheduleId: string;
  paused: boolean;
}): Promise<{ ok: true } | RecurringOpError> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  try {
    const database = requireDb();
    const updated = await database
      .update(recurringSchedules)
      .set({
        paused: options.paused ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(recurringSchedules.id, options.scheduleId),
          eq(recurringSchedules.workspaceId, workspaceId),
        ),
      )
      .returning({ id: recurringSchedules.id });
    if (!updated[0]) {
      return { ok: false, error: "not_found" };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export async function skipNextRecurring(options: {
  workspaceId: string;
  scheduleId: string;
  todayIso: string;
}): Promise<{ ok: true; nextRunOn: string } | RecurringOpError> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  try {
    return await withDbTransaction(async (tx) => {
      const loaded = await loadSchedule(tx, workspaceId, options.scheduleId);
      if (!loaded) {
        return { ok: false, error: "not_found" };
      }
      const cadence = RecurringCadenceSchema.safeParse(loaded.schedule.cadence);
      if (!cadence.success) {
        return { ok: false, error: "invalid_cadence" };
      }
      const nextRunOn = advanceNextRunUntilFuture(
        loaded.schedule.nextRunOn,
        options.todayIso,
        cadence.data,
        loaded.schedule.dayOfMonth,
      );
      await tx
        .update(recurringSchedules)
        .set({ nextRunOn, updatedAt: new Date() })
        .where(eq(recurringSchedules.id, options.scheduleId));
      return { ok: true, nextRunOn };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export async function deleteRecurringTemplate(options: {
  workspaceId: string;
  templateId: string;
}): Promise<{ ok: true } | RecurringOpError> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  try {
    const database = requireDb();
    const deleted = await database
      .delete(invoiceTemplates)
      .where(
        and(
          eq(invoiceTemplates.id, options.templateId),
          eq(invoiceTemplates.workspaceId, workspaceId),
        ),
      )
      .returning({ id: invoiceTemplates.id });
    if (!deleted[0]) {
      return { ok: false, error: "not_found" };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export async function runScheduleNow(options: {
  workspaceId: string;
  scheduleId: string;
  todayIso: string;
}): Promise<{ ok: true; invoiceId: string } | RecurringOpError> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  try {
    return await withDbTransaction(async (tx) => {
      const loaded = await loadSchedule(tx, workspaceId, options.scheduleId);
      if (!loaded) {
        return { ok: false, error: "not_found" };
      }
      const materialized = await materializeFromTemplate(tx, {
        workspaceId,
        scheduleId: loaded.schedule.id,
        issuerId: loaded.template.issuerId,
        clientId: loaded.template.clientId,
        payloadJson: loaded.template.payloadJson,
        paymentDueDays: loaded.template.paymentDueDays,
        todayIso: options.todayIso,
      });
      if (!materialized.ok) {
        return materialized;
      }
      await tx
        .update(recurringSchedules)
        .set({
          lastRunOn: options.todayIso,
          lastInvoiceId: materialized.invoiceId,
          updatedAt: new Date(),
        })
        .where(eq(recurringSchedules.id, options.scheduleId));
      return materialized;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export async function runDueRecurringForWorkspace(options: {
  workspaceId: string;
  todayIso: string;
}): Promise<{ created: number; skipped: number; errors: string[] }> {
  const workspaceId = resolveWorkspaceId(options.workspaceId);
  const createdIds: string[] = [];
  const errors: string[] = [];
  let skipped = 0;

  const database = tryCreateDbFromEnv();
  if (!database) {
    return { created: 0, skipped: 0, errors: ["DATABASE_URL is not set"] };
  }

  const due = await database
    .select({
      schedule: recurringSchedules,
      template: invoiceTemplates,
    })
    .from(recurringSchedules)
    .innerJoin(
      invoiceTemplates,
      eq(recurringSchedules.templateId, invoiceTemplates.id),
    )
    .where(
      and(
        eq(recurringSchedules.workspaceId, workspaceId),
        eq(recurringSchedules.paused, 0),
        lte(recurringSchedules.nextRunOn, options.todayIso),
      ),
    );

  for (const row of due) {
    const cadence = RecurringCadenceSchema.safeParse(row.schedule.cadence);
    if (!cadence.success) {
      errors.push(`${row.schedule.id}: invalid_cadence`);
      continue;
    }
    try {
      const result = await withDbTransaction(async (tx) => {
        const loaded = await loadSchedule(
          tx,
          workspaceId,
          row.schedule.id,
          true,
        );
        if (!loaded || loaded.schedule.paused === 1) {
          return { ok: false, error: "not_due" } as const;
        }
        if (loaded.schedule.nextRunOn > options.todayIso) {
          return { ok: false, error: "not_due" } as const;
        }
        const lockedCadence = RecurringCadenceSchema.safeParse(
          loaded.schedule.cadence,
        );
        if (!lockedCadence.success) {
          return { ok: false, error: "invalid_cadence" } as const;
        }
        const materialized = await materializeFromTemplate(tx, {
          workspaceId,
          scheduleId: loaded.schedule.id,
          issuerId: loaded.template.issuerId,
          clientId: loaded.template.clientId,
          payloadJson: loaded.template.payloadJson,
          paymentDueDays: loaded.template.paymentDueDays,
          todayIso: options.todayIso,
        });
        if (!materialized.ok) {
          return materialized;
        }
        const nextRunOn = advanceNextRunUntilFuture(
          loaded.schedule.nextRunOn,
          options.todayIso,
          lockedCadence.data,
          loaded.schedule.dayOfMonth,
        );
        await tx
          .update(recurringSchedules)
          .set({
            lastRunOn: options.todayIso,
            lastInvoiceId: materialized.invoiceId,
            nextRunOn,
            updatedAt: new Date(),
          })
          .where(eq(recurringSchedules.id, loaded.schedule.id));
        return materialized;
      });
      if (!result.ok) {
        if (
          result.error === "open_draft" ||
          result.error === "missing_parties" ||
          result.error === "not_due"
        ) {
          skipped += 1;
        } else {
          errors.push(`${row.schedule.id}: ${result.error}`);
        }
        continue;
      }
      createdIds.push(result.invoiceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${row.schedule.id}: ${message}`);
    }
  }

  return { created: createdIds.length, skipped, errors };
}
