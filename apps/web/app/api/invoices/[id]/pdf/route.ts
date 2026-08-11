import { requireWorkspaceForRoute } from "@/lib/auth/api";
import { serveInvoicePdf } from "@/lib/serve-invoice-file";
import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, ctx: { params: Params }) {
	const { id } = await ctx.params;
	const gate = await requireWorkspaceForRoute(request);
	if ("response" in gate) {
		return gate.response;
	}
	const { workspaceId } = gate.context;
	const rows = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
		.limit(1);
	const row = rows[0];
	if (!row) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}

	try {
		return await serveInvoicePdf(row);
	} catch (cause) {
		const message =
			cause instanceof Error ? cause.message : "pdf render failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
