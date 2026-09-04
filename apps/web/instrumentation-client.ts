import { initBotId } from "botid/client/core";

/**
 * Attach BotID tokens on these fetches. Eve session/stream is same-origin
 * but not a Next route — without a token, Vercel Security Checkpoint returns
 * an HTML interstitial that the chat used to dump as the error. Do not add
 * OAuth callback GETs; those have no BotID headers.
 */
initBotId({
  protect: [
    { path: "/api/auth/*", method: "POST" },
    { path: "/api/demo/invoice-pdf", method: "POST" },
    { path: "/api/generator/issue", method: "POST" },
    { path: "/eve/v1/session", method: "POST" },
    { path: "/eve/v1/session/*", method: "POST" },
    { path: "/eve/v1/session/*", method: "GET" },
  ],
});
