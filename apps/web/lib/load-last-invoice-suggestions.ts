import {
  suggestionsFromInvoice,
  type LastInvoiceSuggestions,
} from "@/lib/last-invoice-suggestions";
import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { InvoiceSchema } from "@invoicey/invoice-core/schema";
import { and, desc, eq, isNotNull, isNull, ne, type SQL } from "drizzle-orm";

type LoadLastInvoiceOpts = {
  issuerId?: string;
  clientId?: string;
  excludeId?: string;
};

async function queryLatestInvoice(
  workspaceId: string,
  extra: SQL[],
  preferIssued: boolean,
): Promise<{ payloadJson: Record<string, unknown> } | null> {
  const base = [eq(invoices.workspaceId, workspaceId), ...extra];
  if (preferIssued) {
    const issued = await db
      .select({ payloadJson: invoices.payloadJson })
      .from(invoices)
      .where(
        and(
          ...base,
          isNotNull(invoices.issuedAt),
          isNull(invoices.cancelledAt),
        ),
      )
      .orderBy(desc(invoices.issuedAt), desc(invoices.createdAt))
      .limit(1);
    if (issued[0]) {
      return issued[0];
    }
  }
  const any = await db
    .select({ payloadJson: invoices.payloadJson })
    .from(invoices)
    .where(and(...base, isNull(invoices.cancelledAt)))
    .orderBy(desc(invoices.createdAt))
    .limit(1);
  return any[0] ?? null;
}

function parseSuggestions(
  row: { payloadJson: Record<string, unknown> } | null,
): LastInvoiceSuggestions | null {
  if (!row) {
    return null;
  }
  const parsed = InvoiceSchema.safeParse(row.payloadJson);
  if (!parsed.success) {
    return null;
  }
  return suggestionsFromInvoice(parsed.data);
}

/** Last invoice for issuer+client, then issuer, then workspace. */
export async function loadLastInvoiceSuggestions(
  workspaceId: string,
  opts: LoadLastInvoiceOpts = {},
): Promise<LastInvoiceSuggestions | null> {
  const extra: SQL[] = [];
  if (opts.excludeId) {
    extra.push(ne(invoices.id, opts.excludeId));
  }

  if (opts.issuerId && opts.clientId) {
    const pair = [
      ...extra,
      eq(invoices.issuerId, opts.issuerId),
      eq(invoices.clientId, opts.clientId),
    ];
    const fromPairIssued = parseSuggestions(
      await queryLatestInvoice(workspaceId, pair, true),
    );
    if (fromPairIssued) {
      return fromPairIssued;
    }
    const fromPairAny = parseSuggestions(
      await queryLatestInvoice(workspaceId, pair, false),
    );
    if (fromPairAny) {
      return fromPairAny;
    }
  }

  if (opts.issuerId) {
    const fromIssuer = parseSuggestions(
      await queryLatestInvoice(
        workspaceId,
        [...extra, eq(invoices.issuerId, opts.issuerId)],
        true,
      ),
    );
    if (fromIssuer) {
      return fromIssuer;
    }
  }

  return parseSuggestions(await queryLatestInvoice(workspaceId, extra, true));
}
