import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { hashPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";

import { invoiceyIdentityOptions } from "./invoicey-identity";

// Regression: enabling passwords must not open public registration or let an
// OAuth-only user acquire credentials through reset/set-password endpoints.
async function fixture() {
  const userId = "provisioned-reviewer";
  const password = "review-fixture-password-123";
  const now = new Date();
  const database = {
    user: [
      {
        id: userId,
        name: "Review",
        email: "review@example.test",
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    account: [
      {
        id: "credential-reviewer",
        userId,
        accountId: userId,
        providerId: "credential",
        password: await hashPassword(password),
        createdAt: now,
        updatedAt: now,
      },
    ],
    session: [],
    verification: [],
  };
  const auth = betterAuth({
    ...invoiceyIdentityOptions,
    baseURL: "http://localhost:3000",
    secret: "identity-integration-test-secret-32-characters",
    database: memoryAdapter(database),
  });
  const post = (route: string, body: Record<string, string>) =>
    auth.handler(
      new Request(`http://localhost:3000/api/auth${route}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify(body),
      }),
    );
  return { post, database, password };
}

describe("operator-provisioned identity", () => {
  it("authenticates the stored hash and creates a normal session", async () => {
    const f = await fixture();
    const response = await f.post("/sign-in/email", {
      email: "review@example.test",
      password: f.password,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("session_token");
    expect(f.database.session).toHaveLength(1);
  });
  it("rejects incorrect credentials without creating a session", async () => {
    const f = await fixture();
    const response = await f.post("/sign-in/email", {
      email: "review@example.test",
      password: "wrong-password-value",
    });
    expect(response.status).toBe(401);
    expect(f.database.session).toHaveLength(0);
  });
  it("refuses direct public registration even when the UI is bypassed", async () => {
    const f = await fixture();
    const response = await f.post("/sign-up/email", {
      name: "Intruder",
      email: "new@example.test",
      password: f.password,
    });
    expect(response.ok).toBe(false);
    expect(f.database.user).toHaveLength(1);
    expect(f.database.account).toHaveLength(1);
  });
  it("blocks password reset and credential-enrollment endpoints", async () => {
    const f = await fixture();
    for (const route of [
      "/request-password-reset",
      "/reset-password",
      "/set-password",
    ]) {
      const response = await f.post(route, {
        email: "review@example.test",
        password: f.password,
        newPassword: f.password,
        token: "invented",
      });
      expect(response.status).toBe(404);
    }
    expect(f.database.verification).toHaveLength(0);
  });
});
