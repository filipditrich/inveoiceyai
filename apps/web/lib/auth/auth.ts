import "server-only";
import { sendWorkspaceInviteEmail } from "@/lib/email/invite";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { mcp, organization } from "better-auth/plugins";

import { authSchema } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

import {
  deviceCookieOptions,
  readDeviceTokenFromHeaders,
} from "./device-trust";
import { checkAcceptPolicy, checkInvitePolicy } from "./invite-policy";
import { onSessionCreated } from "./on-session-created";
import { takePendingDeviceToken } from "./pending-device-cookie";
import { assignReferralCodeOnCreate } from "./referral";
import {
  createPersonalWorkspace,
  resolveInitialWorkspaceId,
} from "./workspace-bootstrap";
import { applyWorkspacePlanBootstrap } from "./workspace-plan-bootstrap";

const baseURL = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;

/**
 * Only register a provider when it is fully configured. A half-configured
 * provider would otherwise be a sign-in button that fails after the redirect,
 * with an opaque error from the provider rather than a missing-env one.
 */
const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          // No explicit `scope`: better-auth already requests
          // `read:user user:email`, which is what lets users with a private
          // primary email still resolve one. Setting it again just duplicates.
        },
      }
    : {}),
};

/**
 * No local secret assertion: `betterAuth()` already throws
 * "You are using the default secret" at construction whenever
 * `NODE_ENV=production` and no secret is set, so a hand-rolled check is dead
 * code that only duplicates a clearer library error.
 *
 * Consequence to know about: `next build` runs with `NODE_ENV=production`, so
 * once a route imports this module, builds require `BETTER_AUTH_SECRET` to be
 * present at build time as well as at runtime.
 */

/**
 * Better Auth server instance (Plan 14, ADR 0018).
 *
 * `organization` is remapped onto our existing `workspaces` table (ADR 0019) so
 * `session.activeOrganizationId` is literally the value every business query
 * puts in `WHERE workspace_id = ?` — one tenancy id, no translation layer.
 *
 * Uses the validated `db` client on purpose: `tryCreateDbFromEnv()` can return
 * `null`, which would produce a silently broken auth server.
 */
export const auth = betterAuth({
  appName: "Invoicey",
  baseURL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),

  // OAuth only — no email+password (ADR 0018).
  emailAndPassword: { enabled: false },
  socialProviders,

  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 10,
    max: 100,
  },

  /**
   * Both providers verify email addresses, so linking the same person's Google
   * and GitHub logins is safe. `allowDifferentEmails` stays off deliberately.
   */
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
  },

  user: {
    additionalFields: {
      /** Workspace used by machine identities, which carry no active-org cookie. */
      defaultWorkspaceId: { type: "string", required: false, input: false },
      /** Platform ops console (ADR 0024); input:false so clients cannot self-elevate. */
      platformRole: {
        type: "string",
        required: false,
        defaultValue: "none",
        input: false,
      },
      referralCode: { type: "string", required: false, input: false },
      referredByUserId: { type: "string", required: false, input: false },
      /** Czech PDF footer verb; edited from account settings. */
      gender: {
        type: "string",
        required: false,
        defaultValue: "unspecified",
        input: true,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await createPersonalWorkspace(createdUser);
          await assignReferralCodeOnCreate(createdUser.id);
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // RSC cannot set cookies, so the active workspace is resolved here,
          // once, at session creation. `requireWorkspace()` then just reads it.
          const activeOrganizationId = await resolveInitialWorkspaceId(
            session.userId,
          );
          return { data: { ...session, activeOrganizationId } };
        },
        after: async (session, context) => {
          await onSessionCreated(session, context);
        },
      },
    },
  },

  /** Persist pending `invoicey_did`; `nextCookies` (last plugin) writes Set-Cookie. */
  hooks: {
    /**
     * Invitations go through Better Auth's own organization endpoint, so
     * `assertCan` never sees them. Seat and domain policy is enforced here or
     * nowhere — the UI hint alone would not be enforcement (ADR 0035).
     */
    before: createAuthMiddleware(async (ctx) => {
      const refuse = (verdict: {
        ok: false;
        code: string;
        message: string;
      }) => {
        throw new APIError("FORBIDDEN", {
          code: verdict.code.toUpperCase(),
          message: verdict.message,
        });
      };

      if (ctx.path === "/organization/invite-member") {
        const workspaceId =
          (ctx.body as { organizationId?: string } | undefined)
            ?.organizationId ??
          ctx.context.session?.session.activeOrganizationId;
        const email = (ctx.body as { email?: string } | undefined)?.email;
        if (!workspaceId || !email) return;

        const verdict = await checkInvitePolicy({ workspaceId, email });
        if (!verdict.ok) refuse(verdict);
        return;
      }

      // Re-checked at accept, not only at send: invitations live 48 hours, so a
      // seat can be taken or a domain rule tightened in between. Checking once
      // would let a stale invitation walk past the limit (ADR 0035).
      if (ctx.path === "/organization/accept-invitation") {
        const invitationId = (ctx.body as { invitationId?: string } | undefined)
          ?.invitationId;
        if (!invitationId) return;

        const verdict = await checkAcceptPolicy(invitationId);
        if (!verdict.ok) refuse(verdict);
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Better Auth's `createOrganization` inserts the workspace row itself, so
      // none of our bootstrap runs for it. Without this, every workspace after
      // a user's first landed on the default plan with no signup grant — the
      // escape hatch the domain rule exists to close (ADR 0035).
      if (ctx.path === "/organization/create") {
        const workspaceId = (
          ctx.context.returned as { id?: string } | undefined
        )?.id;
        const owner = ctx.context.session?.user;
        if (workspaceId && owner) {
          try {
            await applyWorkspacePlanBootstrap({
              workspaceId,
              owner: {
                email: owner.email,
                emailVerified: owner.emailVerified,
              },
            });
          } catch (error) {
            // The workspace exists either way; failing the request here would
            // leave the user with a workspace they were told was not created.
            console.error("[invoicey] workspace plan bootstrap failed", error);
          }
        }
      }

      const created = ctx.context.newSession?.session;
      if (!created?.id) return;
      const pending = takePendingDeviceToken(created.id);
      if (!pending) return;
      if (ctx.headers && readDeviceTokenFromHeaders(ctx.headers)) return;
      const cookie = deviceCookieOptions(pending);
      ctx.setCookie(cookie.name, cookie.value, cookie.attributes);
    }),
  },

  plugins: [
    organization({
      // Default roles (owner/admin/member) match the requirement, so no
      // custom access control.
      creatorRole: "owner",
      /** 48h — shown in invite email + members UI (Plan 19). */
      invitationExpiresIn: 60 * 60 * 48,
      async sendInvitationEmail(data) {
        const inviteUrl = `${baseURL.replace(/\/$/, "")}/invite/${data.id}`;
        try {
          await sendWorkspaceInviteEmail({
            workspaceId: data.organization.id,
            workspaceName: data.organization.name,
            to: data.email,
            inviterName: data.inviter.user.name || data.inviter.user.email,
            inviterEmail: data.inviter.user.email,
            role: data.role,
            inviteUrl,
            expiresAt: data.invitation.expiresAt,
          });
        } catch (err) {
          /** keep invite row; Settings still shows copyable link */
          console.error("[invoicey] invitation email failed", err);
          console.info("[invoicey] invitation created (email skipped)", {
            invitationId: data.id,
            email: data.email,
            inviteUrl,
          });
        }
      },
    }),
    mcp({ loginPage: "/sign-in" }),
    apiKey(),
    // Must stay last: it writes any Set-Cookie the request produced.
    nextCookies(),
  ],
});
