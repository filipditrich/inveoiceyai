import { initBotId } from "botid/client/core";

/** Only POST — OAuth provider callbacks are GETs without BotID headers. */
initBotId({
  protect: [
    { path: "/api/auth/*", method: "POST" },
    { path: "/api/demo/invoice-pdf", method: "POST" },
  ],
});
