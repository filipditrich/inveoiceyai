import "server-only";

import { ensureIssuerNumberingSchemes } from "@/lib/issuer-numbering";
import type { NumberingSchemeDraft } from "@/lib/issuer-types";
import type { IssuerEmailSettings } from "@invoicey/db";
import { issuerBusinesses, issuerNumberingSchemes } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  IssuerSnapshotSchema,
  type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache } from "react";

export type LoadedIssuer = {
  id: string;
  source: string;
  snapshot: IssuerSnapshot;
  emailSettings: IssuerEmailSettings;
  schemes: NumberingSchemeDraft[];
  isDefault: boolean;
};

/** Load issuer for edit section pages; 404 when missing or snapshot invalid. */
export const loadIssuerForEdit = cache(async function loadIssuerForEdit(
  workspaceId: string,
  issuerId: string,
): Promise<LoadedIssuer> {
  const rows = await db
    .select()
    .from(issuerBusinesses)
    .where(
      and(
        eq(issuerBusinesses.id, issuerId),
        eq(issuerBusinesses.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    notFound();
  }

  const snapshot = IssuerSnapshotSchema.safeParse(row.snapshot);
  if (!snapshot.success) {
    notFound();
  }

  await ensureIssuerNumberingSchemes(db, { workspaceId, issuerId });

  const schemeRows = await db
    .select()
    .from(issuerNumberingSchemes)
    .where(eq(issuerNumberingSchemes.issuerId, issuerId));

  const schemes: NumberingSchemeDraft[] = [];
  for (const s of schemeRows) {
    if (
      s.docType !== "invoice" &&
      s.docType !== "proforma" &&
      s.docType !== "advance" &&
      s.docType !== "credit_note"
    ) {
      continue;
    }
    schemes.push({
      docType: s.docType,
      template: s.template,
      resetPeriod: s.resetPeriod === "never" ? "never" : "yearly",
      counter: s.counter,
      counterYear: s.counterYear,
      padding: s.padding,
    });
  }

  return {
    id: row.id,
    source: row.source,
    snapshot: snapshot.data,
    emailSettings: row.emailSettings ?? {},
    schemes,
    isDefault: row.isDefault,
  };
});
