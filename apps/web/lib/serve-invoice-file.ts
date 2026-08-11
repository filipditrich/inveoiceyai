import { ensureInvoiceArtifacts } from "@invoicey/invoice-tools/artifacts";
import { InvoiceSchema, renderInvoicePdf, renderIsdoc } from "@invoicey/invoice-core";
import type { invoices } from "@invoicey/db";
import { NextResponse } from "next/server";

type InvoiceRow = typeof invoices.$inferSelect;

async function proxyStoredFile(
	url: string,
	filename: string,
	contentType: string,
): Promise<NextResponse> {
	const upstream = await fetch(url);
	if (!upstream.ok || !upstream.body) {
		throw new Error(`artifact fetch failed: ${upstream.status}`);
	}
	return new NextResponse(upstream.body, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Cache-Control": "private, max-age=31536000, immutable",
		},
	});
}

/** Serve issued artifact from storage, with lazy backfill; drafts always regenerate. */
export async function serveInvoicePdf(row: InvoiceRow): Promise<NextResponse> {
	const parsed = InvoiceSchema.safeParse(row.payloadJson);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid payload" }, { status: 500 });
	}
	const filename = `${parsed.data.meta.number || "draft"}-isdoc.pdf`;

	if (row.issuedAt) {
		if (row.pdfUrl) {
			try {
				return await proxyStoredFile(row.pdfUrl, filename, "application/pdf");
			} catch {
				/** fall through to regenerate + re-persist */
			}
		}
		const artifacts = await ensureInvoiceArtifacts({
			id: row.id,
			workspaceId: row.workspaceId,
			invoice: parsed.data,
		}).catch(() => null);
		if (artifacts?.pdfUrl) {
			try {
				return await proxyStoredFile(artifacts.pdfUrl, filename, "application/pdf");
			} catch {
				/** fall through to live render */
			}
		}
	}

	const pdfBytes = await renderInvoicePdf(parsed.data);
	return new NextResponse(Buffer.from(pdfBytes), {
		status: 200,
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Cache-Control": row.issuedAt
				? "private, max-age=300"
				: "no-store",
		},
	});
}

export async function serveInvoiceIsdoc(row: InvoiceRow): Promise<NextResponse> {
	const parsed = InvoiceSchema.safeParse(row.payloadJson);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid payload" }, { status: 500 });
	}
	const filename = `${parsed.data.meta.number || "draft"}.isdoc`;

	if (row.issuedAt) {
		if (row.isdocUrl) {
			try {
				return await proxyStoredFile(
					row.isdocUrl,
					filename,
					"application/xml; charset=utf-8",
				);
			} catch {
				/** fall through */
			}
		}
		const artifacts = await ensureInvoiceArtifacts({
			id: row.id,
			workspaceId: row.workspaceId,
			invoice: parsed.data,
		}).catch(() => null);
		if (artifacts?.isdocUrl) {
			try {
				return await proxyStoredFile(
					artifacts.isdocUrl,
					filename,
					"application/xml; charset=utf-8",
				);
			} catch {
				/** fall through */
			}
		}
	}

	const xml = renderIsdoc(parsed.data);
	return new NextResponse(xml, {
		status: 200,
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Cache-Control": row.issuedAt ? "private, max-age=300" : "no-store",
		},
	});
}
