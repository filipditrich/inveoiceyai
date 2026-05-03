import { InvoiceSchema, renderInvoicePdf } from "@invoicey/invoice-core";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Validates posted JSON against `InvoiceSchema` and streams a PDF preview.
 */
export async function POST(request: NextRequest) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "invalid json body" }, { status: 400 });
	}

	const parsed = InvoiceSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{
				error: "invoice validation failed",
				issues: parsed.error.flatten(),
			},
			{ status: 422 },
		);
	}

	let pdfBytes: Uint8Array;
	try {
		pdfBytes = await renderInvoicePdf(parsed.data);
	} catch (cause) {
		const message =
			cause instanceof Error ? cause.message : "pdf render failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}

	const buffer = Buffer.from(pdfBytes);
	return new NextResponse(buffer, {
		status: 200,
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": 'inline; filename="invoice-preview.pdf"',
			"Cache-Control": "no-store",
		},
	});
}
