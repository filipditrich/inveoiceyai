import { eq } from "drizzle-orm";

import {
  tryCreateDbFromEnv,
  user as userTable,
  type InvoiceyDb,
} from "@invoicey/db";
import type { DbTransaction } from "@invoicey/db/transaction";
import {
  parseIssuedByGender,
  type Invoice,
  type IssuedBySnapshot,
} from "@invoicey/invoice-core/schema";

import { getInvoiceyRequestContext } from "./workspace-context";

export function issuedByFromProfile(input: {
  name: string;
  gender: unknown;
}): IssuedBySnapshot | null {
  const name = input.name.trim();
  if (name.length === 0) {
    return null;
  }
  return {
    name: name.slice(0, 200),
    gender: parseIssuedByGender(input.gender),
  };
}

export function withIssuedBy(
  invoice: Invoice,
  issuedBy: IssuedBySnapshot | null | undefined,
): Invoice {
  if (!issuedBy) {
    return invoice;
  }
  return {
    ...invoice,
    meta: {
      ...invoice.meta,
      issuedBy,
    },
  };
}

export async function loadIssuedByForUser(
  database: InvoiceyDb | DbTransaction,
  userId: string | undefined,
): Promise<IssuedBySnapshot | null> {
  const id = userId?.trim();
  if (!id) {
    return null;
  }
  const [row] = await database
    .select({ name: userTable.name, gender: userTable.gender })
    .from(userTable)
    .where(eq(userTable.id, id))
    .limit(1);
  if (!row) {
    return null;
  }
  return issuedByFromProfile(row);
}

export async function loadIssuedByFromRequest(
  database?: InvoiceyDb | DbTransaction | null,
): Promise<IssuedBySnapshot | null> {
  const userId = getInvoiceyRequestContext()?.userId;
  const db = database ?? tryCreateDbFromEnv();
  if (!db) {
    return null;
  }
  return loadIssuedByForUser(db, userId);
}
