import { requireWorkspaceForRoute } from "@/lib/auth/api";
import { incomingDocuments } from "@invoicey/db";
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
  const [row] = await db
    .select()
    .from(incomingDocuments)
    .where(
      and(
        eq(incomingDocuments.id, id),
        eq(incomingDocuments.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const res = await fetch(row.fileUrl);
  if (!res.ok) {
    return NextResponse.json(
      { error: "upstream_fetch_failed" },
      { status: 502 },
    );
  }
  const bytes = await res.arrayBuffer();
  const disposition =
    request.nextUrl.searchParams.get("disposition") === "inline"
      ? "inline"
      : "attachment";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Disposition": `${disposition}; filename="${row.fileName.replaceAll('"', "")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
