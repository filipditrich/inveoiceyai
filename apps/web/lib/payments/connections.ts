import "server-only";
import { and, eq, inArray } from "drizzle-orm";

import { bankConnections } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export type ActiveBankConnection = {
  id: string;
  provider: "fio" | "moneta";
};

/** The connections a workspace-triggered sync should touch, in either provider. */
export async function listActiveBankConnections(
  workspaceId: string,
): Promise<ActiveBankConnection[]> {
  const rows = await db
    .select({
      id: bankConnections.id,
      provider: bankConnections.provider,
    })
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.workspaceId, workspaceId),
        eq(bankConnections.status, "active"),
        inArray(bankConnections.provider, ["fio", "moneta"]),
      ),
    );
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider === "moneta" ? "moneta" : "fio",
  }));
}
