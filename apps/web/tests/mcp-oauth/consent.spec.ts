import { test, expect, type Page } from "@playwright/test";
import { createLocalJWKSet, jwtVerify } from "jose";
import { createHash, randomUUID } from "node:crypto";

const origin = "http://localhost:3123";
const verifier = "browser-pkce-verifier-at-least-43-characters-9328";

async function signIn(page: Page) {
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: {
      email: `oauth-${randomUUID()}@example.test`,
      password: "test-browser-password-281",
      name: "OAuth browser",
    },
  });
  expect(signup.ok()).toBeTruthy();
}

async function authorization(page: Page) {
  const registered = await page.request.post("/api/auth/oauth2/register", {
    headers: { cookie: "", origin },
    data: {
      client_name: "ChatGPT browser test",
      redirect_uris: [origin + "/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "invoicey:read invoicey:write offline_access",
    },
  });
  expect(registered.ok(), await registered.text()).toBeTruthy();
  const client = await registered.json();
  const params = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: origin + "/callback",
    response_type: "code",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    scope: "invoicey:read invoicey:write offline_access",
    resource: origin + "/api/mcp",
    state: "browser-state",
  });
  return {
    clientId: client.client_id,
    url: "/api/auth/oauth2/authorize?" + params,
  };
}

async function startConsent(page: Page) {
  await signIn(page);
  const flow = await authorization(page);
  await page.goto(flow.url);
  await expect(
    page.getByRole("button", { name: "Allow access", exact: true }),
  ).toBeVisible();
  return flow;
}

async function assertWorkspace(page: Page, token: string) {
  const jwks = await (await page.request.get("/api/auth/jwks")).json();
  const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
    issuer: origin + "/api/auth",
    audience: origin + "/api/mcp",
  });
  expect(payload.workspace_id).toBe("workspace-b");
}

// Reproduced production's "request not found" 500 before the server action fix.
test("consent completes PKCE exchange and refresh for the selected workspace", async ({
  page,
}) => {
  const { clientId } = await startConsent(page);
  await page.getByRole("combobox").selectOption("workspace-b");
  await page.getByRole("button", { name: "Allow access", exact: true }).click();
  await expect(page).toHaveURL(/\/callback\?/);
  const callback = new URL(page.url());
  expect(callback.searchParams.get("state")).toBe("browser-state");
  const token = await page.request.post("/api/auth/oauth2/token", {
    headers: { cookie: "", origin },
    form: {
      grant_type: "authorization_code",
      client_id: clientId,
      code: callback.searchParams.get("code") ?? "",
      code_verifier: verifier,
      redirect_uri: origin + "/callback",
      resource: origin + "/api/mcp",
    },
  });
  expect(token.status()).toBe(200);
  const result = await token.json();
  await assertWorkspace(page, result.access_token);
  const refresh = await page.request.post("/api/auth/oauth2/token", {
    headers: { cookie: "", origin },
    form: {
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: result.refresh_token,
      resource: origin + "/api/mcp",
    },
  });
  expect(refresh.status()).toBe(200);
  await assertWorkspace(page, (await refresh.json()).access_token);
});

test("cancel returns access_denied with the original state and no code", async ({
  page,
}) => {
  await startConsent(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/callback\?/);
  const callback = new URL(page.url());
  expect(callback.searchParams.get("error")).toBe("access_denied");
  expect(callback.searchParams.get("state")).toBe("browser-state");
  expect(callback.searchParams.has("code")).toBe(false);
});

test("signed-in login continuation reaches consent and completes authorization", async ({
  page,
}) => {
  await signIn(page);
  const { url } = await authorization(page);
  // Obtain the provider-signed login continuation before attaching our session.
  const response = await page.request.get(url, {
    headers: { cookie: "", origin },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  await page.goto(response.headers().location);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Allow access", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Allow access", exact: true }).click();
  await expect(page).toHaveURL(/\/callback\?.*code=/);
});

test("bare consent link offers a fresh connection without a broken form", async ({
  page,
}) => {
  const response = await page.goto("/mcp/connect/consent");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Start the connection again" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Allow access" })).toHaveCount(
    0,
  );
});

test("tampered authorization query is rejected without a server error or callback", async ({
  page,
}) => {
  await startConsent(page);
  await page.locator('input[name="oauthQuery"]').evaluate((input) => {
    // SAFETY: the locator targets the production form's hidden HTML input.
    const field = input as HTMLInputElement;
    const query = new URLSearchParams(field.value);
    query.set("redirect_uri", "https://attacker.example/callback");
    field.value = query.toString();
  });
  const response = page.waitForResponse(
    (res) => res.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Allow access", exact: true }).click();
  expect((await response).status()).toBeLessThan(500);
  await expect(page).toHaveURL(origin + "/mcp/connect/error");
  await expect(
    page.getByRole("heading", { name: "Start the connection again" }),
  ).toBeVisible();
});

test("expired consent link cannot submit an authorization", async ({
  page,
}) => {
  await startConsent(page);
  const expired = new URL(page.url());
  expired.searchParams.set("exp", "1");
  await page.goto(expired.toString());
  await expect(
    page.getByRole("heading", { name: "Start the connection again" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Allow access" })).toHaveCount(
    0,
  );
});
