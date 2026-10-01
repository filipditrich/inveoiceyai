"use client";

import { apiKeyClient } from "@better-auth/api-key/client";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client. `baseURL` is omitted deliberately so calls go to
 * the current origin, which keeps preview deployments working.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient(), apiKeyClient(), oauthProviderClient()],
});

export const { signIn, signOut, useSession } = authClient;
