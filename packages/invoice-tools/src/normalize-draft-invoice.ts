import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { randomUUID } from "node:crypto";

import { parseCzAddressText } from "@invoicey/ares";
import {
  calcTotals,
  exclusiveUnitPriceFromInclusive,
} from "@invoicey/invoice-core";
import { LookRefSchema, type LookRef } from "@invoicey/invoice-core/looks";
import {
  ClientSnapshotSchema,
  InvoiceCurrencySchema,
  InvoiceLanguageSchema,
  InvoiceMetaSchema,
  InvoiceSchema,
  InvoiceVatSchema,
  PaymentSchema,
  type Invoice,
  type InvoiceCurrency,
  type InvoiceLanguage,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";

const PRAGUE = "Europe/Prague";

/** Beyond this, a supplied issue date reads as invented rather than intended. */
const SUSPECT_DATE_DRIFT_DAYS = 45;

export type VatPreset = "neplatce" | "regular" | "reverse_charge" | "oss";

export interface NormalizedIssue {
  path: string;
  message: string;
}

/**
 * One field the normalizer filled in because the caller left it out.
 *
 * Callers surface these so a person can see what was assumed and correct it
 * before the invoice is issued — a silent default the user never sees is the
 * same bug as a wrong one.
 */
export interface DraftAssumption {
  /** Dotted draft path, e.g. `meta.dueDate`. Stable enough to patch by. */
  path: string;
  /** Short human label, e.g. `Due date`. */
  label: string;
  /** Resolved value, already display-formatted. */
  value: string;
  /** Why this value was chosen. */
  reason: string;
  /**
   * `notable` when a person plausibly wants this changed and getting it wrong
   * costs them something — the due date, the currency, the price basis.
   * `routine` when the default is what almost everyone means (issue date is
   * today, DUZP follows the issue date, a document is an invoice). Both are
   * tagged in place on the card; only `notable` ones are worth a warning.
   */
  severity: "notable" | "routine";
  /**
   * `default` — the caller left the field out and we filled it in.
   * `suspect` — the caller *did* supply a value, but it does not survive a
   * sanity check. A model asked for an invoice with no date will sometimes
   * invent one rather than omit it, and a supplied value is otherwise treated
   * as the user's own and never flagged. This is the backstop for that.
   */
  kind: "default" | "suspect";
}

const LANGUAGE_LABELS: Record<InvoiceLanguage, string> = {
  cs: "Czech",
  en: "English",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  proforma: "Proforma",
  advance: "Advance",
  credit_note: "Credit note",
};

const VAT_MODE_LABELS: Record<string, string> = {
  regular: "Regular",
  reverse_charge: "Reverse charge",
  oss: "OSS",
};

const SUPPLIES_ABROAD_LABELS: Record<string, string> = {
  none: "domestic",
  eu: "EU",
  non_eu: "outside EU",
};

/** `Regular · domestic` — the pair a person actually reads. */
export function formatVatIntent(vat: {
  mode: string;
  suppliesAbroad: string;
}): string {
  const mode = VAT_MODE_LABELS[vat.mode] ?? vat.mode;
  const abroad =
    SUPPLIES_ABROAD_LABELS[vat.suppliesAbroad] ?? vat.suppliesAbroad;
  return `${mode} · ${abroad}`;
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

function vatFromPreset(preset: unknown): Record<string, unknown> | undefined {
  switch (preset) {
    case "neplatce":
    case "regular":
      return { mode: "regular", suppliesAbroad: "none" };
    case "reverse_charge":
      return { mode: "reverse_charge", suppliesAbroad: "none" };
    case "oss":
      return { mode: "oss", suppliesAbroad: "eu" };
    default:
      return undefined;
  }
}

/**
 * Merges a partial invoice draft with a locked issuer, recomputes totals, and validates.
 * Optional draft fields: `vatPreset`, `pricesIncludeVat` (stripped before schema validate).
 */
export function normalizeDraftToInvoice(
  draft: unknown,
  issuer: IssuerSnapshot,
):
  | { ok: true; invoice: Invoice; assumptions: DraftAssumption[] }
  | { ok: false; issues: NormalizedIssue[] } {
  const assumptions: DraftAssumption[] = [];
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

  const issueDateGiven =
    typeof metaRaw.issueDate === "string" && metaRaw.issueDate.length > 0;
  const issueDate = issueDateGiven
    ? (metaRaw.issueDate as string)
    : todayPragueYmd();
  if (!issueDateGiven) {
    assumptions.push({
      path: "meta.issueDate",
      label: "Issue date",
      value: issueDate,
      reason: "today in Europe/Prague",
      severity: "routine",
      kind: "default",
    });
  }

  /**
   * A supplied issue date far from today is almost always invented rather than
   * meant: real back-dating lands within weeks, and nobody bills far forward.
   * Flag it instead of trusting it — a supplied value is otherwise never
   * questioned, and an unquestioned wrong date is exactly what this mechanism
   * exists to prevent.
   */
  if (issueDateGiven) {
    const drift = Math.abs(
      (Date.parse(`${issueDate}T12:00:00Z`) -
        Date.parse(`${todayPragueYmd()}T12:00:00Z`)) /
        86_400_000,
    );
    if (Number.isFinite(drift) && drift > SUSPECT_DATE_DRIFT_DAYS) {
      assumptions.push({
        path: "meta.issueDate",
        label: "Issue date",
        value: issueDate,
        reason: `${Math.round(drift)} days from today — check this is what you meant`,
        severity: "notable",
        kind: "suspect",
      });
    }
  }

  const draftStamp = formatInTimeZone(new Date(), PRAGUE, "yyyyMMdd-HHmm");
  const dueDefault = addCalendarDaysYmd(issueDate, 14);

  const dueDateGiven =
    typeof metaRaw.dueDate === "string" && metaRaw.dueDate.length > 0;
  const dueDate = dueDateGiven ? (metaRaw.dueDate as string) : dueDefault;
  if (!dueDateGiven) {
    assumptions.push({
      path: "meta.dueDate",
      label: "Due date",
      value: dueDate,
      reason: "issue date + 14 days",
      severity: "notable",
      kind: "default",
    });
  }

  const duzpGiven = typeof metaRaw.duzp === "string" && metaRaw.duzp.length > 0;
  const duzp = duzpGiven ? (metaRaw.duzp as string) : issueDate;
  if (!duzpGiven) {
    assumptions.push({
      path: "meta.duzp",
      label: "DUZP",
      value: duzp,
      reason: "same as issue date",
      severity: "routine",
      kind: "default",
    });
  }

  const languageParsed = InvoiceLanguageSchema.safeParse(metaRaw.language);
  const language = languageParsed.success
    ? languageParsed.data
    : ("cs" as InvoiceLanguage);
  if (!languageParsed.success) {
    assumptions.push({
      path: "meta.language",
      label: "Document language",
      value: LANGUAGE_LABELS[language],
      reason: "not specified",
      severity: "notable",
      kind: "default",
    });
  }

  const currencyParsed = InvoiceCurrencySchema.safeParse(metaRaw.currency);
  const currency = currencyParsed.success
    ? currencyParsed.data
    : ("CZK" as InvoiceCurrency);
  if (!currencyParsed.success) {
    assumptions.push({
      path: "meta.currency",
      label: "Currency",
      value: currency,
      reason: "not specified",
      severity: "notable",
      kind: "default",
    });
  }

  const docType = (metaRaw.docType ?? "invoice") as string;
  if (metaRaw.docType == null) {
    assumptions.push({
      path: "meta.docType",
      label: "Document type",
      value: DOC_TYPE_LABELS[docType] ?? docType,
      reason: "not specified",
      severity: "routine",
      kind: "default",
    });
  }

  const mergedMeta = {
    docType,
    number:
      typeof metaRaw.number === "string" && metaRaw.number.length > 0
        ? metaRaw.number
        : `DRAFT-${draftStamp}`,
    issueDate,
    dueDate,
    duzp,
    language,
    currency,
    correctedInvoiceNumber:
      typeof metaRaw.correctedInvoiceNumber === "string"
        ? metaRaw.correctedInvoiceNumber
        : undefined,
    issuedBy: metaRaw.issuedBy,
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

  const pricesIncludeVat = draft.pricesIncludeVat === true;
  const vatRaw = isRecord(draft.vat)
    ? draft.vat
    : vatFromPreset(draft.vatPreset);

  const vatParsed = InvoiceVatSchema.safeParse(vatRaw);
  if (!vatParsed.success) {
    return {
      ok: false,
      issues: vatParsed.error.issues.map((i) => ({
        path: ["vat", ...i.path.map(String)].join(".") || "vat",
        message: i.message,
      })),
    };
  }

  let vatData = vatParsed.data;
  if (!issuer.vatPayer && vatData.mode !== "regular") {
    assumptions.push({
      path: "vat.mode",
      label: "VAT mode",
      value: VAT_MODE_LABELS.regular,
      reason: "issuer is not a VAT payer",
      severity: "notable",
      kind: "default",
    });
    vatData = { ...vatData, mode: "regular" };
  } else if (!issuer.vatPayer) {
    vatData = { ...vatData, mode: "regular" };
  }
  /** A bare `vatPreset` reached here without an explicit `vat` intent. */
  if (!isRecord(draft.vat)) {
    assumptions.push({
      path: "vat",
      label: "VAT treatment",
      value: formatVatIntent(vatData),
      reason: `expanded from preset "${String(draft.vatPreset)}"`,
      severity: "notable",
      kind: "default",
    });
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
    const pos = typeof row.position === "number" ? row.position : i + 1;
    const desc = row.description;
    const qty = row.quantity;
    const unit = row.unit;
    const unitPrice = row.unitPriceWithoutVat;
    const vatRate = row.vatRate;
    if (
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
              "each line needs description, quantity, unit, unitPriceWithoutVat, vatRate",
          },
        ],
      };
    }

    const forceZero = !issuer.vatPayer || vatData.mode === "reverse_charge";
    const effectiveRate = forceZero ? 0 : vatRate;
    const conversionRate =
      vatData.mode === "reverse_charge" || !issuer.vatPayer ? 0 : vatRate;
    const exclusive = pricesIncludeVat
      ? exclusiveUnitPriceFromInclusive(unitPrice, conversionRate)
      : unitPrice;

    lineInputs.push({
      position: pos,
      description: desc,
      quantity: qty,
      unit,
      unitPriceWithoutVat: exclusive,
      vatRate: effectiveRate,
    });
    i += 1;
  }

  /**
   * "10 000 for the website" is ambiguous the moment VAT applies, and the
   * gap between the two readings is the VAT rate. Surface the reading we
   * took whenever the caller did not state one.
   */
  const vatApplies =
    issuer.vatPayer &&
    vatData.mode !== "reverse_charge" &&
    lineInputs.some((line) => line.vatRate > 0);
  if (draft.pricesIncludeVat == null && vatApplies) {
    assumptions.push({
      path: "pricesIncludeVat",
      label: "Line prices",
      value: "excluding VAT",
      reason: "not specified",
      severity: "notable",
      kind: "default",
    });
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
    vatData,
    issuer.vatPayer,
  );

  const notes =
    typeof draft.notes === "string" && draft.notes.length > 0
      ? draft.notes
      : undefined;

  let look: LookRef | undefined;
  if (draft.look !== undefined) {
    const lookParsed = LookRefSchema.safeParse(draft.look);
    if (!lookParsed.success) {
      return {
        ok: false,
        issues: lookParsed.error.issues.map((issue) => ({
          path: ["look", ...issue.path.map(String)].join(".") || "look",
          message: issue.message,
        })),
      };
    }
    look = lookParsed.data;
  }

  const candidate: Invoice = {
    meta: metaParsed.data,
    issuer,
    client: clientParsed.data,
    vat: vatData,
    payment: payParsed.data,
    items: builtItems,
    totals,
    notes,
    ...(look ? { look } : {}),
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

  return { ok: true, invoice: invParsed.data, assumptions };
}
