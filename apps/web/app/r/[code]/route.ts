import { NextResponse } from "next/server";

import {
  findUserByReferralCode,
  readReferralCodeFromHeaders,
  recordReferralClick,
  referralCookieOptions,
} from "@/lib/auth/referral";
import { appOrigin } from "@/lib/email/security";

export const runtime = "nodejs";

/** set invoicey_ref + log click, then redirect to landing */
export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await context.params;
  const origin = appOrigin().replace(/\/$/, "");
  const referrer = await findUserByReferralCode(raw);

  if (!referrer) {
    return NextResponse.redirect(`${origin}/r/invalid`);
  }

  const landUrl = `${origin}/r/${encodeURIComponent(referrer.referralCode)}/land`;
  const existing = readReferralCodeFromHeaders(request.headers);
  const res = NextResponse.redirect(landUrl);
  const cookie = referralCookieOptions(referrer.referralCode);
  res.cookies.set(cookie.name, cookie.value, cookie.attributes);

  if (existing !== referrer.referralCode) {
    try {
      await recordReferralClick({
        referrerUserId: referrer.id,
        code: referrer.referralCode,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });
    } catch (err) {
      console.error("[invoicey] referral click failed", err);
    }
  }

  return res;
}
