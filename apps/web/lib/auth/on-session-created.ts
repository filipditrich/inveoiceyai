import "server-only";

import {
  createTrustToken,
  findTrustedDevice,
  loadUserEmail,
  newDeviceToken,
  readDeviceTokenFromHeaders,
  summarizeUserAgent,
  touchTrustedDevice,
} from "./device-trust";
import { stashPendingDeviceToken } from "./pending-device-cookie";
import { maybePromotePlatformAdminFromAllowlist } from "./platform-admin";
import { isEligibleForReferralAttribution } from "./referral-eligibility";
import {
  attributeReferralFromCode,
  readReferralCodeFromHeaders,
} from "./referral";
import { recordSecurityAuditEvent } from "./security-audit";
import { appOrigin, sendNewSignInEmail } from "../email/security";

type SessionRow = {
  id: string;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  activeOrganizationId?: string | null;
};

type AuthHookContext = {
  headers?: Headers | { get: (name: string) => string | null };
} | null;

/** Soft device trust + new-sign-in email; never throws into the auth pipeline. */
export async function onSessionCreated(
  session: SessionRow,
  context: AuthHookContext,
): Promise<void> {
  try {
    const ip = session.ipAddress ?? null;
    const ua = session.userAgent ?? null;

    await recordSecurityAuditEvent({
      userId: session.userId,
      workspaceId: session.activeOrganizationId ?? null,
      type: "sign_in",
      ipAddress: ip,
      userAgent: ua,
    });

    await maybePromotePlatformAdminFromAllowlist(session.userId);

    const headers = context?.headers;
    const profile = await loadUserEmail(session.userId);
    const referralCode = headers ? readReferralCodeFromHeaders(headers) : null;
    if (
      referralCode &&
      profile?.createdAt &&
      isEligibleForReferralAttribution(profile.createdAt)
    ) {
      await attributeReferralFromCode({
        newUserId: session.userId,
        code: referralCode,
        ipAddress: ip,
        userAgent: ua,
      });
    }

    let rawToken = headers ? readDeviceTokenFromHeaders(headers) : null;
    if (!rawToken) {
      rawToken = newDeviceToken();
      stashPendingDeviceToken(session.id, rawToken);
    }

    const trusted = await findTrustedDevice({
      userId: session.userId,
      rawToken,
    });
    if (trusted) {
      await touchTrustedDevice(trusted.id, ip);
      return;
    }

    if (!profile?.email) return;
    const workspaceId =
      session.activeOrganizationId?.trim() ||
      profile.defaultWorkspaceId?.trim() ||
      "";
    if (!workspaceId) {
      console.warn(
        "[invoicey] skip new_sign_in email — no workspace for user",
        session.userId,
      );
      return;
    }

    const origin = appOrigin();
    const trustToken = createTrustToken({
      userId: session.userId,
      rawDeviceToken: rawToken,
    });
    const trustUrl = `${origin}/security/trust?token=${encodeURIComponent(trustToken)}`;
    const securitySettingsUrl = `${origin}/settings/account/security`;
    const signedInAt = new Intl.DateTimeFormat("cs-CZ", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Prague",
    }).format(new Date());

    await sendNewSignInEmail({
      workspaceId,
      to: profile.email,
      userName: profile.name,
      ipAddress: ip,
      userAgent: summarizeUserAgent(ua),
      signedInAt,
      trustUrl,
      securitySettingsUrl,
    });
  } catch (err) {
    console.error("[invoicey] onSessionCreated failed", err);
  }
}
