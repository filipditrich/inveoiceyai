import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Regression: identity login must retain the requested continuation and show
// recoverable errors, on desktop and phones, using the production form.
test("provisioned credentials sign in through the identity form", async ({
  page,
}) => {
  const email = `identity-${randomUUID()}@example.test`;
  const password = "browser-identity-password-29";
  // Fixture-only signup seeds a credential. Production blocks this endpoint;
  // the HTTP integration suite verifies the production restriction.
  const seeded = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Review", email, password },
  });
  expect(seeded.ok()).toBeTruthy();
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Continue with Invoicey Identity" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Unable to sign in" }),
  ).toContainText("Unable to sign in");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/callback$/);
  const session = await page.request.get("/api/auth/get-session");
  expect((await session.json()).user.email).toBe(email);
});
