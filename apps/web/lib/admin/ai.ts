import "server-only";
import { desc, eq, sql } from "drizzle-orm";

import {
  aiTokenBalances,
  aiUsageEvents,
  user,
  workspaces,
  workspaceTokenGrants,
  type AiUsageProduct,
  type TokenGrantTrigger,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

import { utcDaysAgo } from "./constants";

export type AdminAiDayPoint = {
  day: string;
  web: number;
  slack: number;
  mcp: number;
  extract: number;
  total: number;
};

export type AdminAiProductRow = {
  product: AiUsageProduct;
  tokens: number;
  events: number;
};

export type AdminAiWorkspaceRow = {
  workspaceId: string;
  workspaceName: string;
  tokens: number;
};

export type AdminAiGrantRow = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  trigger: TokenGrantTrigger;
  tokens: number;
  grantedByEmail: string | null;
  note: string | null;
  createdAt: Date;
};

export type PlatformAiUsage = {
  remainingGifted: number;
  remainingMonthly: number;
  remainingPurchased: number;
  burn30d: number;
  byProduct: AdminAiProductRow[];
  byDay: AdminAiDayPoint[];
  topWorkspaces: AdminAiWorkspaceRow[];
  recentGrants: AdminAiGrantRow[];
};

export type WorkspaceAiMonitor = {
  burn30d: number;
  byDay: AdminAiDayPoint[];
  grants: {
    id: string;
    trigger: TokenGrantTrigger;
    tokens: number;
    note: string | null;
    createdAt: Date;
  }[];
};

function emptyDayMap(
  days: number,
  now = new Date(),
): Map<string, AdminAiDayPoint> {
  const map = new Map<string, AdminAiDayPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    map.set(day, { day, web: 0, slack: 0, mcp: 0, extract: 0, total: 0 });
  }
  return map;
}

function applyProduct(
  point: AdminAiDayPoint,
  product: string,
  tokens: number,
): void {
  if (product === "web") point.web += tokens;
  else if (product === "slack") point.slack += tokens;
  else if (product === "mcp") point.mcp += tokens;
  else point.extract += tokens;
  point.total += tokens;
}

export async function loadPlatformAiUsage(): Promise<PlatformAiUsage> {
  const window30d = utcDaysAgo(30);
  const dayMap = emptyDayMap(30);

  const [[remainRow], [burnRow], productRows, dayRows, topRows, grantRows] =
    await Promise.all([
      db
        .select({
          gifted: sql<number>`coalesce(sum(${aiTokenBalances.giftedRemaining}), 0)`,
          monthly: sql<number>`coalesce(sum(${aiTokenBalances.monthlyRemaining}), 0)`,
          purchased: sql<number>`coalesce(sum(${aiTokenBalances.purchasedRemaining}), 0)`,
        })
        .from(aiTokenBalances),
      db
        .select({
          value: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)`,
        })
        .from(aiUsageEvents)
        .where(
          sql`${aiUsageEvents.kind} = 'llm' and ${aiUsageEvents.createdAt} >= ${window30d}`,
        ),
      db
        .select({
          product: aiUsageEvents.product,
          tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)`,
          events: sql<number>`count(*)::int`,
        })
        .from(aiUsageEvents)
        .where(sql`${aiUsageEvents.createdAt} >= ${window30d}`)
        .groupBy(aiUsageEvents.product),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${aiUsageEvents.createdAt}), 'YYYY-MM-DD')`,
          product: aiUsageEvents.product,
          tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)`,
        })
        .from(aiUsageEvents)
        .where(
          sql`${aiUsageEvents.kind} = 'llm' and ${aiUsageEvents.createdAt} >= ${window30d}`,
        )
        .groupBy(
          sql`to_char(date_trunc('day', ${aiUsageEvents.createdAt}), 'YYYY-MM-DD')`,
          aiUsageEvents.product,
        ),
      db
        .select({
          workspaceId: aiUsageEvents.workspaceId,
          workspaceName: workspaces.name,
          tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)`,
        })
        .from(aiUsageEvents)
        .innerJoin(workspaces, eq(aiUsageEvents.workspaceId, workspaces.id))
        .where(
          sql`${aiUsageEvents.kind} = 'llm' and ${aiUsageEvents.createdAt} >= ${window30d}`,
        )
        .groupBy(aiUsageEvents.workspaceId, workspaces.name)
        .orderBy(desc(sql`sum(${aiUsageEvents.totalTokens})`))
        .limit(15),
      db
        .select({
          id: workspaceTokenGrants.id,
          workspaceId: workspaceTokenGrants.workspaceId,
          workspaceName: workspaces.name,
          trigger: workspaceTokenGrants.trigger,
          tokens: workspaceTokenGrants.tokens,
          grantedByEmail: user.email,
          note: workspaceTokenGrants.note,
          createdAt: workspaceTokenGrants.createdAt,
        })
        .from(workspaceTokenGrants)
        .innerJoin(
          workspaces,
          eq(workspaceTokenGrants.workspaceId, workspaces.id),
        )
        .leftJoin(user, eq(workspaceTokenGrants.grantedBy, user.id))
        .orderBy(desc(workspaceTokenGrants.createdAt))
        .limit(25),
    ]);

  for (const row of dayRows) {
    const point = dayMap.get(row.day);
    if (!point) continue;
    applyProduct(point, row.product, Number(row.tokens) || 0);
  }

  return {
    remainingGifted: Number(remainRow?.gifted ?? 0),
    remainingMonthly: Number(remainRow?.monthly ?? 0),
    remainingPurchased: Number(remainRow?.purchased ?? 0),
    burn30d: Number(burnRow?.value ?? 0),
    byProduct: productRows.map((row) => ({
      product: row.product,
      tokens: Number(row.tokens) || 0,
      events: Number(row.events) || 0,
    })),
    byDay: [...dayMap.values()],
    topWorkspaces: topRows.map((row) => ({
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName,
      tokens: Number(row.tokens) || 0,
    })),
    recentGrants: grantRows,
  };
}

export async function loadWorkspaceAiMonitor(
  workspaceId: string,
): Promise<WorkspaceAiMonitor> {
  const window30d = utcDaysAgo(30);
  const dayMap = emptyDayMap(30);

  const [[burnRow], dayRows, grants] = await Promise.all([
    db
      .select({
        value: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)`,
      })
      .from(aiUsageEvents)
      .where(
        sql`${aiUsageEvents.workspaceId} = ${workspaceId} and ${aiUsageEvents.kind} = 'llm' and ${aiUsageEvents.createdAt} >= ${window30d}`,
      ),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${aiUsageEvents.createdAt}), 'YYYY-MM-DD')`,
        product: aiUsageEvents.product,
        tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)`,
      })
      .from(aiUsageEvents)
      .where(
        sql`${aiUsageEvents.workspaceId} = ${workspaceId} and ${aiUsageEvents.kind} = 'llm' and ${aiUsageEvents.createdAt} >= ${window30d}`,
      )
      .groupBy(
        sql`to_char(date_trunc('day', ${aiUsageEvents.createdAt}), 'YYYY-MM-DD')`,
        aiUsageEvents.product,
      ),
    db
      .select({
        id: workspaceTokenGrants.id,
        trigger: workspaceTokenGrants.trigger,
        tokens: workspaceTokenGrants.tokens,
        note: workspaceTokenGrants.note,
        createdAt: workspaceTokenGrants.createdAt,
      })
      .from(workspaceTokenGrants)
      .where(eq(workspaceTokenGrants.workspaceId, workspaceId))
      .orderBy(desc(workspaceTokenGrants.createdAt))
      .limit(20),
  ]);

  for (const row of dayRows) {
    const point = dayMap.get(row.day);
    if (!point) continue;
    applyProduct(point, row.product, Number(row.tokens) || 0);
  }

  return {
    burn30d: Number(burnRow?.value ?? 0),
    byDay: [...dayMap.values()],
    grants,
  };
}
