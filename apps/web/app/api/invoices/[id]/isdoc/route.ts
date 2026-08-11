import { requireWorkspaceForRoute } from "@/lib/auth/api";
import { InvoiceSchema, renderIsdoc } from "@invoicey/invoice-core";
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

	const parsed = InvoiceSchema.safeParse(row.payloadJson);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid payload" }, { status: 500 });
	}

	try {
		const xml = renderIsdoc(parsed.data);
		const filename = `${parsed.data.meta.number || "draft"}.isdoc`;
		return new NextResponse(xml, {
			status: 200,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Content-Disposition": `attachment; filename="${filename}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (cause) {
		const message =
			cause instanceof Error ? cause.message : "isdoc render failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
