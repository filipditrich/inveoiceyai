# Invoicey MCP and ChatGPT integration research

Verified 2026-10-01 against primary sources. This is an implementation contract and validation checklist, not a claim that Invoicey has passed the host checks below.

## Versions and compatibility

| Package                          | Verified release / decision                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@openai/mcp-extensions`         | `0.1.0`; official source commit `900032d8bd7c1566202d0cb1666986584f932043`; requires Node >=22                                                                      |
| `@modelcontextprotocol/sdk`      | npm latest `1.31.0`, compatible with extensions peer `^1.29.0`                                                                                                      |
| `@modelcontextprotocol/ext-apps` | Pin `1.7.5`, the latest compatible 1.x release. npm latest is `2.0.3`, outside extensions peer `^1.7.5`; do not blindly upgrade both to latest                      |
| `@openai/apps-sdk-ui`            | npm latest `0.2.2`; peers React 18/19 and Tailwind >=4.0.10                                                                                                         |
| `@better-auth/oauth-provider`    | `1.6.26` exists and peers `better-auth ^1.6.26`; matching Invoicey's current auth avoids a broader migration. Registry `release-1.6` is `1.6.33`; latest is `1.7.7` |

Versions above were checked with `npm view` during research. The extension SDK has separate `/server` and `/app` exports, plus `/app/styles.css` and `/app/transport`; no root import. Its own Zod dependency is 4.4.3. [SDK package](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/package.json), [SDK setup](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/README.md), [Better Auth 1.6.26 package](https://github.com/better-auth/better-auth/blob/v1.6.26/packages/oauth-provider/package.json).

## Recommended product surface

Implementation recommendation: keep the interoperable invoice MCP toolset as the source of truth and add a small MCP App for browsing invoice results, inspecting a selected invoice, opening its stored PDF, and continuing the conversation with an explicit selection. Global navigation opens Invoicey; a thread entrypoint opens an `Invoice list` tab. Mutations use the same authorized server functions as the existing product. A packaged skill teaches safe invoice drafting and issuance, and an onboarding skill checks workspace/issuer readiness.

OpenAI-specific extensions supplement MCP Apps; they must be capability-gated. The current support matrix explicitly describes ChatGPT Work and excludes classic ChatGPT. Global/thread entrypoints, structured settings, and display modes are listed across desktop, Work web, and mobile. Composer mentions and file entrypoints are desktop-only; OpenAI form elicitation is desktop/web, not mobile. Do not market all these controls as universal ChatGPT features. [Platform matrix](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/docs/spec.md#platform-support).

## Exact server and app APIs

```ts
// Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OpenAIExtensions } from "@openai/mcp-extensions/server";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

const server = new McpServer({ name: "invoicey", version: "1.0.0" });
const extensions = new OpenAIExtensions(server);
```

Register a resource with `mimeType: RESOURCE_MIME_TYPE` (`text/html;profile=mcp-app`) and self-contained HTML. Associate tools through `_meta.ui.resourceUri`. Add entrypoints under `_meta["openai/ui"].entrypoints`, for example `[{type:"global"}]` or `[{type:"thread"}]`. Entry tools must accept `{}`. A `global` entry may have `quickAction: {title, icons, target:{type:"tool",name,arguments}}`. `visibility: ["app"]` hides a tool from model discovery while preserving app calls and static entrypoints. Provide a distinct, human-readable thread title and a monochrome transparent SVG tool icon, ideally a 20×20 viewbox and 1.33px stroke. [Entrypoints](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/docs/spec.md#mcp-app-entrypoints), [validated metadata types](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/src/server/ui.ts).

Resource content metadata can declare `_meta["openai/ui"]: {preferredDisplayMode:"fullscreen", availableDisplayModes:["inline","fullscreen"]}`. Entrypoints use fullscreen; ordinary model-triggered views default inline. `pip` appears in SDK types but the current ChatGPT spec says it is unsupported. [Display modes](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/docs/spec.md#display-modes).

```ts
// Browser bundle
import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import { OpenAIExtensions } from "@openai/mcp-extensions/app";
import "@openai/mcp-extensions/app/styles.css";

const app = new App({ name: "Invoicey", version: "1.0.0" });
const extensions = new OpenAIExtensions(app);
const applyHostContext = (context: ReturnType<App["getHostContext"]>) => {
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables)
    applyHostStyleVariables(context.styles.variables);
};
app.addEventListener("hostcontextchanged", applyHostContext);
app.ontoolresult = (result) =>
  renderValidatedInvoiceResult(result.structuredContent);
await app.connect();
applyHostContext(app.getHostContext());
```

Install listeners **before** connecting so initial results are not missed. Use that result for first render instead of immediately recalling the tool. Call tools through `app.callServerTool({name,arguments})`, checking `isError`. Bundle CSS into the HTML resource because the iframe CSP can block external stylesheets. The extension stylesheet offers native-looking `card`, `form-label`, `form-control`, `btn`, `btn-primary`, and `cursor-interaction`. The optional Apps SDK UI library provides accessible React components and design tokens. Apply host themes and variables dynamically, preserving keyboard and touch usability. [App setup and stylesheet](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/README.md#mcp-app-setup), [UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines).

### Composer references and selection context

```ts
extensions.mentions.setHandler(async ({ query }, extra) => ({
  items: (await searchAuthorizedInvoices(query, extra.authInfo)).map(
    (invoice) => ({
      type: "resource_link" as const,
      uri: `invoicey://invoices/${invoice.id}`,
      name: invoice.number,
      title: invoice.number,
      mimeType: "text/markdown",
    }),
  ),
}));
```

The helper registers an app-visible `search_mentions` tool. Returned resource URIs must have a working, tenant-authorized `resources/read` path; never advertise unrelated tenants through mention search. Limit results and search work. [Mention implementation](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/src/server/mentions.ts).

In the app, `extensions.modelContext?.update({content,structuredContent})` attaches the selected invoice to the composer; each call replaces that app instance's previous context. Use `extensions.modelContext?.getCurrent()` on initialization and host changes to restore selection/removal. Send a user-triggered follow-up with `extensions.message?.send({role:"user",content:[{type:"text",text:prompt}]})`; this preserves the user's existing draft. These APIs are undefined until the host advertises support, so provide a useful fallback and do not send automatically. `extensions.deepLink.getCurrent()` returns current route context; validate URLs before navigating. [Context API](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/src/app/model-context.ts), [message API](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/src/app/message.ts), [deep links](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/src/app/deep-link.ts).

### Native settings and forms

`extensions.settings.register({fields,layout,read,update})` creates `settings.read`/`settings.update` and advertises native settings capability. Fields support boolean, string, string enum, number, or integer; no object/union fields or schema defaults. Return every effective setting from both handlers. Updates preserve omitted fields and must persist atomically before returning. Both handlers receive request context for authorization. Good Invoicey candidates are document language and whether paid invoices are initially shown. Do not use a global mutable setting to change the workspace bound to an OAuth grant. [Settings SDK](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/src/server/settings.ts).

`extensions.elicitInput({mode:"form",message,requestedSchema})` supports native suggestions, described choices, thumbnails, and resource pickers. It throws when `clientCapabilities.extensions["openai/elicitation"].form` is absent. Check capability and offer ordinary conversation/UI fallback. Treat `accept`, `decline`, and `cancel` separately; requesting a form alone must never write an invoice. [Elicitation SDK](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/src/server/forms/elicitation.ts), [field schema](https://github.com/openai/mcp-extensions/blob/900032d8bd7c1566202d0cb1666986584f932043/typescript/src/server/forms/fields.ts).

## OAuth without a broad Better Auth upgrade

ChatGPT uses OAuth authorization-code + S256 PKCE for user access; a static Invoicey PAT prompt is insufficient. Publish protected-resource metadata, OAuth discovery, exact resource/audience binding, tool security schemes, and useful 401 challenges. Current OpenAI guidance prefers CIMD but still supports DCR. Better Auth **1.6.26 supports DCR, not CIMD**; do not advertise CIMD when retaining this version. [OpenAI auth](https://developers.openai.com/plugins/build/auth), [1.6.26 metadata](https://github.com/better-auth/better-auth/blob/v1.6.26/packages/oauth-provider/src/metadata.ts).

```ts
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";

// Integrate these into the existing Better Auth plugins, not a second auth server.
jwt({ jwt: { issuer: "https://invoicey.app/api/auth" } });
oauthProvider({
  loginPage: "/login",
  consentPage: "/oauth/consent",
  scopes: [
    "openid",
    "email",
    "profile",
    "offline_access",
    "invoices:read",
    "invoices:write",
  ],
  grantTypes: ["authorization_code", "refresh_token"],
  validAudiences: ["https://invoicey.app/api/mcp"],
  allowDynamicClientRegistration: true,
  allowUnauthenticatedClientRegistration: true,
  postLogin: {
    page: "/oauth/workspace",
    shouldRedirect: async (context) => mustChooseWorkspace(context),
    consentReferenceId: async ({ session, user }) =>
      requireMemberWorkspace(user.id, session.activeOrganizationId),
  },
  customAccessTokenClaims: async ({ user, referenceId }) => ({
    workspace_id: await requireMemberWorkspace(user?.id, referenceId),
  }),
});
```

The example callbacks represent Invoicey authorization functions, not exports from Better Auth. Bind the consent to a selected workspace and persist its ID in the grant. Refresh uses the stored `refreshToken.referenceId`, so changing the web session's active workspace must not move an existing integration's data access. Recheck membership and role on every MCP request, not only when minting the token. [Post-login contract](https://github.com/better-auth/better-auth/blob/v1.6.26/docs/content/docs/plugins/oauth-provider.mdx#post-login-screen), [token refresh implementation](https://github.com/better-auth/better-auth/blob/v1.6.26/packages/oauth-provider/src/token.ts).

Add `oauthProviderClient()` from `@better-auth/oauth-provider/client` to the browser auth client. Workspace selection calls `organization.setActive({organizationId})`, then `oauth2.oauth2Continue({postLogin:true})`. Consent calls `oauth2.consent({accept:true})` or `accept:false`; the provider client carries the signed `oauth_query` from the current location. Keep the signed query intact through the consent/workspace UI rather than reconstructing trust from displayed parameters. [Client plugin](https://github.com/better-auth/better-auth/blob/v1.6.26/packages/oauth-provider/src/client.ts), [consent validation](https://github.com/better-auth/better-auth/blob/v1.6.26/packages/oauth-provider/src/consent.ts).

Use `oauthProviderAuthServerMetadata(auth)` and `oauthProviderOpenIdConfigMetadata(auth)` from the provider for framework well-known routes. The issuer, `authorization_servers`, discovery `issuer`, and verification issuer must match exactly, including `/api/auth` if used. Protected resource is `https://invoicey.app/api/mcp`; advertise it and accept only that audience. [Metadata helpers](https://github.com/better-auth/better-auth/blob/v1.6.26/packages/oauth-provider/src/metadata.ts).

```ts
import { verifyAccessToken } from "better-auth/oauth2";

const claims = await verifyAccessToken(token, {
  jwksUrl: "https://invoicey.app/api/auth/jwks",
  verifyOptions: {
    issuer: "https://invoicey.app/api/auth",
    audience: "https://invoicey.app/api/mcp",
  },
  scopes: ["invoices:read"],
});
// Validate sub/workspace_id shape, current membership, role, and operation scopes.
```

Alternatively `oauthProviderResourceClient(auth)` exposes `verifyAccessToken` and metadata helpers. Explicit endpoints avoid base URL/path inference mistakes. Provider schema requires `oauthClient`, `oauthConsent`, `oauthAccessToken`, and `oauthRefreshToken`, plus JWT plugin `jwks`. Reuse the exact version's schema: 1.7 has changed fields and should not be copied into 1.6. [Resource client](https://github.com/better-auth/better-auth/blob/v1.6.26/packages/oauth-provider/src/client-resource.ts), [database schema](https://github.com/better-auth/better-auth/blob/v1.6.26/packages/oauth-provider/src/schema.ts).

Return `WWW-Authenticate: Bearer resource_metadata="https://invoicey.app/.well-known/oauth-protected-resource/api/mcp"` for missing/invalid credentials. Tool errors that trigger relinking use `_meta["mcp/www_authenticate"]` with an error and description. Tool security schemes declare OAuth scopes; UI state and model-supplied workspace IDs are not credentials. [Authentication contract](https://developers.openai.com/plugins/build/auth).

## Plugin packaging and distribution

Current packaging guidance prefers root `plugin.json` with `$schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"`, root `mcp.json`, `skills/`, and `assets/`. OpenAI metadata lives under `extensions.com.openai`, including `interface` and `onboardingSkill: "./skills/setup/SKILL.md"`. `.codex-plugin/plugin.json` remains a supported compatibility fallback. When root `extensions.com.openai` exists it replaces, rather than merges with, the compatibility overlay. [Packaging](https://developers.openai.com/plugins/build/plugins).

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "invoicey": {
      "type": "streamable-http",
      "url": "https://invoicey.app/api/mcp"
    }
  }
}
```

Package skills for invoice work and setup; include only real prompts and capabilities. Preserve missing-field clarification, workspace seller locking, and explicit user intent for issuance/email. Local/repo marketplace installation supports development. Public directory publication requires a public HTTPS endpoint and OpenAI review; a committed plugin bundle or deployed route is not directory approval. [Plugin architecture](https://developers.openai.com/plugins/concepts/plugins), [submission](https://developers.openai.com/plugins/deploy/submission).

## Verification and release evidence

Before declaring the feature working, record separate evidence for:

1. **Protocol:** Streamable HTTP initialize, tool/resource listing, schema validation, correct annotations, valid `structuredContent`, pagination/search, representative success/error/empty cases, and generic MCP compatibility.
2. **Authorization:** real authorization-code/S256 flow, denial, refresh, invalid issuer/audience/expiry, insufficient scopes, revocation behavior, lost workspace membership, cross-tenant resource reads, and an existing grant remaining in its selected workspace after web workspace switching.
3. **UI:** host handshake, initial result without duplicate fetch, tools called from controls, CSP, light/dark styles, narrow screen, keyboard focus, loading/error/retry, remount state, supported display modes, and missing-extension fallbacks.
4. **Native host:** install the complete plugin; verify global/thread entrypoints, mentions on desktop, native settings persistence, selection context and removal, auth after installation, and packaged skill behavior. A mock host proves browser integration code, not real ChatGPT support.
5. **Workflow:** choose a real authorized workspace, browse an invoice, inspect its stored artifact, create a validated draft from conversation, review it, then exercise authorized issuance/delivery only with a controlled test fixture and destination.

Use MCP Inspector first. Current ChatGPT path is Settings → Security and login → Developer mode, then Plugins → plus → public MCP URL (or Secure MCP Tunnel for development). Refresh the connection after changing metadata and start a new chat. Record direct, indirect, follow-up, negative, and confirmation-sensitive evaluation prompts. Test packaged skills as well as server tools. Host account/workspace policy can limit developer mode; publication requires review outside a code deployment. [Official connection/testing guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Only after these checks pass should marketing say the integration is live. Setup documentation must distinguish connecting a developer MCP server, installing a packaged plugin, and availability in the public directory. The current platform matrix should govern feature claims and screenshots.
