import { expect, test } from "@playwright/test";

// Uses only an explicitly configured disposable local workspace with no issuer.
const enabled = process.env.INVOICEY_E2E_LOCAL_QA === "1";
test.skip(!enabled, "Requires the isolated local onboarding fixture.");

test("HTTPS agent sign-in reaches first-company onboarding with a secure session cookie", async ({
  page,
  context,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".localhost"))
    throw new Error("Onboarding fixture must run on local HTTPS.");
  const secret = process.env.INVOICEY_AGENT_LOGIN_SECRET;
  if (!secret) throw new Error("Provide the disposable QA agent secret.");
  await page.goto("/agent-login");
  await page.getByLabel("Shared secret").fill(secret);
  await page
    .getByRole("button", { name: "Issue session", exact: true })
    .click();
  await expect(page).toHaveURL(/\/welcome$/);
  expect(
    (await context.cookies()).some(
      (cookie) =>
        cookie.name === "__Secure-better-auth.session_token" &&
        cookie.secure &&
        cookie.httpOnly,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("manual onboarding fields have usable labels and label taps focus their inputs", async ({
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".localhost"))
    throw new Error("Onboarding fixture must run on local HTTPS.");
  await page.goto("/agent-login");
  await page
    .getByLabel("Shared secret")
    .fill(process.env.INVOICEY_AGENT_LOGIN_SECRET!);
  await page
    .getByRole("button", { name: "Issue session", exact: true })
    .click();
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: /I have an IČO/ }).click();
  await page
    .getByRole("button", { name: "I’ll enter the details myself", exact: true })
    .click();
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await expect(name).toBeVisible();
  for (const label of [
    "IČO",
    "DIČ",
    "Street and number",
    "City",
    "ZIP",
    "Contact email",
  ])
    await expect(
      page.getByRole("textbox", { name: label, exact: true }),
    ).toBeAttached();
  await page.getByText("Name", { exact: true }).click();
  await expect(name).toBeFocused();
});
