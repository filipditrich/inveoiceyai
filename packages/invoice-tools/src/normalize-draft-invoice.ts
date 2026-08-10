import { randomUUID } from "node:crypto";
import { parseCzAddressText } from "@invoicey/ares";
import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { calcTotals } from "@invoicey/invoice-core";
import {
  ClientSnapshotSchema,
  InvoiceMetaSchema,
  InvoiceSchema,
  InvoiceVatSchema,
  PaymentSchema,
  type Invoice,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";

const PRAGUE = "Europe/Prague";

export interface NormalizedIssue {
  path: string;
  message: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Calendar `yyyy-MM-dd` in Europe/Prague for "today". */
export function todayPragueYmd(): string {
  return formatInTimeZone(new Date(), PRAGUE, "yyyy-MM-dd");
}

export function addCalendarDaysYmd(isoDate: string, days: number): string {
  const base = parseISO(`${isoDate}T12:00:00.000Z`);
  const bumped = addDays(base, days);
  return format(bumped, "yyyy-MM-dd");
}

/**
 * Merges a partial invoice draft with a locked issuer, recomputes totals, and validates.
 */
export function normalizeDraftToInvoice(
  draft: unknown,
  issuer: IssuerSnapshot,
): { ok: true; invoice: Invoice } | { ok: false; issues: NormalizedIssue[] } {
  if (!isRecord(draft)) {
    return {
      ok: false,
      issues: [{ path: "", message: "draft must be an object" }],
    };
  }

  const metaRaw = draft.meta;
  if (!isRecord(metaRaw)) {
    return {
      ok: false,
      issues: [{ path: "meta", message: "meta object required" }],
    };
  }

  const issueDate =
    typeof metaRaw.issueDate === "string" && metaRaw.issueDate.length > 0
      ? metaRaw.issueDate
      : todayPragueYmd();

  const draftStamp = formatInTimeZone(new Date(), PRAGUE, "yyyyMMdd-HHmm");
  const dueDefault = addCalendarDaysYmd(issueDate, 14);

  const mergedMeta = {
    docType: metaRaw.docType ?? "invoice",
    number:
      typeof metaRaw.number === "string" && metaRaw.number.length > 0
        ? metaRaw.number
        : `DRAFT-${draftStamp}`,
    issueDate,
    dueDate:
      typeof metaRaw.dueDate === "string" && metaRaw.dueDate.length > 0
        ? metaRaw.dueDate
        : dueDefault,
    duzp:
      typeof metaRaw.duzp === "string" && metaRaw.duzp.length > 0
        ? metaRaw.duzp
        : issueDate,
    language: "cs" as const,
    currency: "CZK" as const,
    correctedInvoiceNumber:
      typeof metaRaw.correctedInvoiceNumber === "string"
        ? metaRaw.correctedInvoiceNumber
        : undefined,
  };

  const clientRaw = draft.client;
  if (!isRecord(clientRaw)) {
    return {
      ok: false,
      issues: [{ path: "client", message: "client object required" }],
    };
  }

  const clientObj = { ...clientRaw };
  if (typeof clientObj.id !== "string" || clientObj.id.length === 0) {
    clientObj.id = randomUUID();
  }

  /** Coerce Slack / model flat address strings into snapshot fields. */
  if (typeof clientObj.address === "string") {
    const parsedAddress = parseCzAddressText(clientObj.address);
    if (parsedAddress) {
      clientObj.address = parsedAddress;
    }
  } else if (isRecord(clientObj.address)) {
    const addr = { ...clientObj.address };
    if (typeof addr.country === "string") {
      const c = addr.country.trim();
      const lower = c.toLocaleLowerCase("cs");
      if (
        lower === "česká republika" ||
        lower === "ceska republika" ||
        lower === "czech republic" ||
        lower === "czechia"
      ) {
        addr.country = "CZ";
      }
    }
    clientObj.address = addr;
  }

  const clientParsed = ClientSnapshotSchema.safeParse(clientObj);
  if (!clientParsed.success) {
    return {
      ok: false,
      issues: clientParsed.error.issues.map((i) => ({
        path: ["client", ...i.path.map(String)].join(".") || "client",
        message: i.message,
      })),
    };
  }

  const vatParsed = InvoiceVatSchema.safeParse(draft.vat);
  if (!vatParsed.success) {
    return {
      ok: false,
      issues: vatParsed.error.issues.map((i) => ({
        path: ["vat", ...i.path.map(String)].join(".") || "vat",
        message: i.message,
      })),
    };
  }

  const paymentRaw = draft.payment;
  if (!isRecord(paymentRaw)) {
    return {
      ok: false,
      issues: [{ path: "payment", message: "payment object required" }],
    };
  }

  const paymentMerged =
    paymentRaw.method === "transfer"
      ? { ...paymentRaw, bankAccount: issuer.bank }
      : paymentRaw;

  const payParsed = PaymentSchema.safeParse(paymentMerged);
  if (!payParsed.success) {
    return {
      ok: false,
      issues: payParsed.error.issues.map((i) => ({
        path: ["payment", ...i.path.map(String)].join(".") || "payment",
        message: i.message,
      })),
    };
  }

  const itemsRaw = draft.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return {
      ok: false,
      issues: [{ path: "items", message: "at least one line item required" }],
    };
  }

  const lineInputs: Array<{
    position: number;
    description: string;
    quantity: number;
    unit: string;
    unitPriceWithoutVat: number;
    vatRate: number;
  }> = [];
  let i = 0;
  for (const row of itemsRaw) {
    if (!isRecord(row)) {
      return {
        ok: false,
        issues: [{ path: `items.${i}`, message: "line must be object" }],
      };
    }
    const pos = row.position;
    const desc = row.description;
    const qty = row.quantity;
    const unit = row.unit;
    const unitPrice = row.unitPriceWithoutVat;
    const vatRate = row.vatRate;
    if (
      typeof pos !== "number" ||
      typeof desc !== "string" ||
      typeof qty !== "number" ||
      typeof unit !== "string" ||
      typeof unitPrice !== "number" ||
      typeof vatRate !== "number"
    ) {
      return {
        ok: false,
        issues: [
          {
            path: `items.${i}`,
            message:
              "each line needs position, description, quantity, unit, unitPriceWithoutVat, vatRate",
          },
        ],
      };
    }
    lineInputs.push({
      position: pos,
      description: desc,
      quantity: qty,
      unit,
      unitPriceWithoutVat: unitPrice,
      vatRate,
    });
    i += 1;
  }

  const metaParsed = InvoiceMetaSchema.safeParse(mergedMeta);
  if (!metaParsed.success) {
    return {
      ok: false,
      issues: metaParsed.error.issues.map((j) => ({
        path: ["meta", ...j.path.map(String)].join(".") || "meta",
        message: j.message,
      })),
    };
  }

  const { items: builtItems, totals } = calcTotals(
    lineInputs,
    vatParsed.data,
    issuer.vatPayer,
  );

  const notes =
    typeof draft.notes === "string" && draft.notes.length > 0
      ? draft.notes
      : undefined;

  const candidate: Invoice = {
    meta: metaParsed.data,
    issuer,
    client: clientParsed.data,
    vat: vatParsed.data,
    payment: payParsed.data,
    items: builtItems,
    totals,
    notes,
  };

  const invParsed = InvoiceSchema.safeParse(candidate);
  if (!invParsed.success) {
    return {
      ok: false,
      issues: invParsed.error.issues.map((k) => ({
        path: k.path.map(String).join(".") || "(root)",
        message: k.message,
      })),
    };
  }

  return { ok: true, invoice: invParsed.data };
}
