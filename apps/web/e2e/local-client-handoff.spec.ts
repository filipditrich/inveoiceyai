import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Writes synthetic clients only to an explicitly opted-in local QA workspace.
test.skip(
  process.env.INVOICEY_E2E_LOCAL_QA !== "1",
  "Requires disposable local QA.",
);

test("adding a client keeps the invoice open and selects the saved client without losing edits", async ({
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".localhost"))
    throw new Error("Client creation QA must use local HTTPS.");
  await page.goto("/invoices/new");
  const line = page.getByLabel("Description", { exact: true }).first();
  await line.fill("Keep this work in progress");
  await page.getByRole("button", { name: "Add manually", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New client", exact: true });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/invoices\/new$/);
  const name = `Inline QA ${testInfo.project.name}`;
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Street and number", { exact: true }).fill("Test 2");
  await dialog.getByLabel("City", { exact: true }).fill("Praha");
  await dialog.getByLabel("ZIP", { exact: true }).fill("11000");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/invoices\/new$/);
  await expect(line).toHaveValue("Keep this work in progress");
  await expect(
    page.getByLabel("Client", { exact: true }).locator("option:checked"),
  ).toHaveText(name);
  await page.reload();
  await expect(line).toHaveValue("Keep this work in progress");
  await expect(
    page.getByLabel("Client", { exact: true }).locator("option:checked"),
  ).toHaveText(name);
  // Re-enter the same identity: the server must return its stored ID, not the temporary form ID.
  const savedId = await page.getByLabel("Client", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Add manually", exact: true }).click();
  for (const [label, value] of [
    ["Name", name],
    ["Street and number", "Test 2"],
    ["City", "Praha"],
    ["ZIP", "11000"],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Client", { exact: true })).toHaveValue(savedId);
  await expect(page.getByRole("option", { name, exact: true })).toHaveCount(1);
});

test("cancelling manual client creation keeps invoice edits and restores focus", async ({
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".localhost"))
    throw new Error("Local QA only");
  await page.goto("/invoices/new");
  await page
    .getByLabel("Description", { exact: true })
    .first()
    .fill("Do not discard on cancel");
  const add = page.getByRole("button", { name: "Add manually", exact: true });
  await add.click();
  const dialog = page.getByRole("dialog", { name: "New client", exact: true });
  await dialog.getByLabel("Name", { exact: true }).fill("Unsaved client");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByLabel("Description", { exact: true }).first(),
  ).toHaveValue("Do not discard on cancel");
  await expect(add).toBeFocused();
});

test("client validation stays in the dialog and a corrected client can be saved", async ({
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".localhost"))
    throw new Error("Local QA only");
  await page.goto("/invoices/new");
  await page.getByRole("button", { name: "Add manually", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New client", exact: true });
  const name = `Validation QA ${testInfo.project.name}`;
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Street and number", { exact: true }).fill("Test 3");
  await dialog.getByLabel("City", { exact: true }).fill("Praha");
  await dialog.getByLabel("ZIP", { exact: true }).fill("11000");
  await dialog.getByLabel("DIČ", { exact: true }).fill("broken");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Invalid DIČ.");
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(name);
  await expect(page).toHaveURL(/\/invoices\/new$/);
  await dialog.getByLabel("DIČ", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByLabel("Client", { exact: true }).locator("option:checked"),
  ).toHaveText(name);
});

test("adding a client to an existing draft preserves unsaved line edits through save", async ({
  page,
}, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".localhost"))
    throw new Error("Local QA only");
  await page.goto("/invoices/new");
  await page
    .getByLabel("Description", { exact: true })
    .first()
    .fill("Original draft work");
  await page.getByLabel("Price", { exact: true }).first().fill("1250");
  await page.getByRole("button", { name: "Add manually", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New client", exact: true });
  for (const [label, value] of [
    ["Name", `Draft source QA ${testInfo.project.name}`],
    ["Street and number", "Test 4"],
    ["City", "Praha"],
    ["ZIP", "11000"],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+\/edit/);
  const draftPath = new URL(page.url()).pathname;
  await page
    .getByLabel("Description", { exact: true })
    .first()
    .fill("Unsaved edits must survive client creation");
  await page.getByRole("button", { name: "Add manually", exact: true }).click();
  const name = `Draft replacement QA ${testInfo.project.name}`;
  for (const [label, value] of [
    ["Name", name],
    ["Street and number", "Test 5"],
    ["City", "Praha"],
    ["ZIP", "11000"],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === draftPath);
  await expect(
    page.getByLabel("Description", { exact: true }).first(),
  ).toHaveValue("Unsaved edits must survive client creation");
  await expect(
    page.getByLabel("Client", { exact: true }).locator("option:checked"),
  ).toHaveText(name);
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      (response.request().postData() ?? "").includes(
        "Unsaved edits must survive client creation",
      ),
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Description", { exact: true }).first(),
  ).toHaveValue("Unsaved edits must survive client creation");
  await expect(
    page.getByLabel("Client", { exact: true }).locator("option:checked"),
  ).toHaveText(name);
});
