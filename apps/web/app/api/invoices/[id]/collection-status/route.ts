import { requireWorkspaceForRoute } from "@/lib/auth/api";
import { can } from "@/lib/authz/can";
import { loadInvoiceCollection } from "@/lib/payments/invoice-collection-repository";
import { heartbeatWatchAndPoll } from "@/lib/payments/watch-session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request, ctx: { params: Params }) {
  const gate = await requireWorkspaceForRoute(request);
  if ("response" in gate) return gate.response;
  if (!(await can("payments:manage"))) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const { id } = await ctx.params;
  const { workspaceId } = gate.context;
  const collection = await loadInvoiceCollection(workspaceId, id);
  if (!collection) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  if (collection.settled) {
    return NextResponse.json(
      {
        paymentState: collection.paymentState,
        paidAmount: collection.paidAmount,
        outstandingAmount: collection.outstandingAmount,
        settled: true,
        polled: false,
        retryAfterMs: 0,
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  const poll = await heartbeatWatchAndPoll({
    workspaceId,
    connectionId: collection.connectionId,
  });
  const fresh = await loadInvoiceCollection(workspaceId, id);
  if (!fresh) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      paymentState: fresh.paymentState,
      paidAmount: fresh.paidAmount,
      outstandingAmount: fresh.outstandingAmount,
      settled: fresh.settled,
      polled: poll.polled,
      retryAfterMs: poll.retryAfterMs,
      refreshError: poll.error,
    },
    { headers: NO_STORE_HEADERS },
  );
}
