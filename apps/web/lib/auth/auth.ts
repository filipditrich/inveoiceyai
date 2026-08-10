import "server-only";

import { apiKey } from "@better-auth/api-key";
import * as schema from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { mcp, organization } from "better-auth/plugins";

import {
  createPersonalWorkspace,
  resolveInitialWorkspaceId,
} from "./workspace-bootstrap";

const baseURL = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;

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
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { ...schema, organization: schema.workspaces },
  }),

  // OAuth only — no email+password (ADR 0018).
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID ?? "",
      clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
      // Required so users with a private primary email still resolve one.
      scope: ["user:email"],
    },
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
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createPersonalWorkspace(user);
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
      },
    },
  },

  plugins: [
    organization({
      // Default roles (owner/admin/member) match the requirement, so no
      // custom access control.
      creatorRole: "owner",
      async sendInvitationEmail(data) {
        // No email provider yet (Plan 14 ships copyable invite links instead).
        // Settings -> Members renders `/invite/<id>` for the inviter to share.
        console.info("[invoicey] invitation created", {
          invitationId: data.id,
          email: data.email,
          organizationId: data.organization.id,
        });
      },
    }),
    mcp({ loginPage: "/sign-in" }),
    apiKey(),
    // Must stay last: it writes any Set-Cookie the request produced.
    nextCookies(),
  ],
});
