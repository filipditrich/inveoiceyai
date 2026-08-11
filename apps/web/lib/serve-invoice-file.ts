import { ensureInvoiceArtifacts } from "@invoicey/invoice-tools/artifacts";
import {
	InvoiceSchema,
	isArchivePayload,
	renderInvoicePdf,
	renderIsdoc,
} from "@invoicey/invoice-core";
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

function displayNumber(row: InvoiceRow): string {
	if (row.number) {
		return row.number;
	}
	if (isArchivePayload(row.payloadJson)) {
		return row.payloadJson.meta.number;
	}
	const parsed = InvoiceSchema.safeParse(row.payloadJson);
	if (parsed.success) {
		return parsed.data.meta.number;
	}
	return "invoice";
}

function isImmutableImport(row: InvoiceRow): boolean {
	return row.artifactsImmutable === 1 || Boolean(row.importCompleteness);
}

export async function serveInvoicePdf(row: InvoiceRow): Promise<NextResponse> {
	const filename = `${displayNumber(row)}-isdoc.pdf`;

	if (isImmutableImport(row)) {
		if (!row.pdfUrl) {
			return NextResponse.json({ error: "imported_pdf_missing" }, { status: 404 });
		}
		try {
			return await proxyStoredFile(row.pdfUrl, filename, "application/pdf");
		} catch {
			return NextResponse.json(
				{ error: "imported_pdf_unavailable" },
				{ status: 502 },
			);
		}
	}

	const parsed = InvoiceSchema.safeParse(row.payloadJson);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid payload" }, { status: 500 });
	}

	if (row.issuedAt) {
		if (row.pdfUrl) {
			try {
				return await proxyStoredFile(row.pdfUrl, filename, "application/pdf");
			} catch {
				/** regenerate below */
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
				/** live render below */
			}
		}
	}

	const pdfBytes = await renderInvoicePdf(parsed.data);
	return new NextResponse(Buffer.from(pdfBytes), {
		status: 200,
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Cache-Control": row.issuedAt ? "private, max-age=300" : "no-store",
		},
	});
}

export async function serveInvoiceIsdoc(row: InvoiceRow): Promise<NextResponse> {
	const filename = `${displayNumber(row)}.isdoc`;

	if (isImmutableImport(row)) {
		if (!row.isdocUrl) {
			return NextResponse.json(
				{ error: "imported_isdoc_missing" },
				{ status: 404 },
			);
		}
		try {
			return await proxyStoredFile(
				row.isdocUrl,
				filename,
				"application/xml; charset=utf-8",
			);
		} catch {
			return NextResponse.json(
				{ error: "imported_isdoc_unavailable" },
				{ status: 502 },
			);
		}
	}

	const parsed = InvoiceSchema.safeParse(row.payloadJson);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid payload" }, { status: 500 });
	}

	if (row.issuedAt) {
		if (row.isdocUrl) {
			try {
				return await proxyStoredFile(
					row.isdocUrl,
					filename,
					"application/xml; charset=utf-8",
				);
			} catch {
				/** regenerate below */
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
				/** live render below */
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
