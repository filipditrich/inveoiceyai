import { NextResponse } from "next/server";

import {
  deviceCookieOptions,
  trustDevice,
  verifyTrustToken,
} from "@/lib/auth/device-trust";
import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import { appOrigin } from "@/lib/email/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  const origin = appOrigin();
  const fail = NextResponse.redirect(
    `${origin}/settings/security?trust=invalid`,
  );

  if (!token) return fail;
  const payload = verifyTrustToken(token);
  if (!payload) return fail;

  try {
    const deviceId = await trustDevice({
      userId: payload.u,
      rawToken: payload.d,
      userAgent: request.headers.get("user-agent"),
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip"),
    });
    await recordSecurityAuditEvent({
      userId: payload.u,
      type: "device_trust",
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent"),
      metadata: { deviceId, via: "email_link" },
    });

    const res = NextResponse.redirect(`${origin}/settings/security?trust=ok`);
    const cookie = deviceCookieOptions(payload.d);
    res.cookies.set(cookie.name, cookie.value, cookie.attributes);
    return res;
  } catch (err) {
    console.error("[invoicey] trust device failed", err);
    return fail;
  }
}
