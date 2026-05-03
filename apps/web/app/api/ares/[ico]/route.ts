import { lookupAresByIcoCached } from "@/lib/cached-ares";
import { IcoSchema } from "@invoicey/invoice-core/schema";
import { NextResponse } from "next/server";

export async function GET(
	_req: Request,
	context: { params: Promise<{ ico: string }> },
) {
	const raw = (await context.params).ico ?? "";
	let icoParsed: string;
	try {
		icoParsed = IcoSchema.parse(raw.trim());
	} catch {
		return NextResponse.json({ error: "invalid ico", message: raw }, { status: 422 });
	}
	const result = await lookupAresByIcoCached(icoParsed);
	const status =
		result.ok ? 200
		: result.kind === "not_found" ? 404
		: result.kind === "invalid_ico" ? 422
		: result.httpStatus !== undefined &&
				result.httpStatus >= 400 &&
				result.httpStatus < 600
			? result.httpStatus
			: 502;
	return NextResponse.json(result, { status });
}
