"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client. `baseURL` is omitted deliberately so calls go to
 * the current origin, which keeps preview deployments working.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { signIn, signOut, useSession } = authClient;
