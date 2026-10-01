import { auth } from "@/lib/auth/auth";
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
export const GET = oauthProviderAuthServerMetadata(auth);
