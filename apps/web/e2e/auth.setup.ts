import { expect, test as setup } from "@playwright/test";

const storageStatePath = process.env.INVOICEY_E2E_AUTH_STORAGE_STATE;
const agentLoginSecret = process.env.INVOICEY_AGENT_LOGIN_SECRET;

setup("create the local agent session", async ({ page }) => {
  if (!storageStatePath || !agentLoginSecret) {
    throw new Error(
      "Agent E2E setup requires INVOICEY_E2E_AUTH_STORAGE_STATE and INVOICEY_AGENT_LOGIN_SECRET.",
    );
  }

  await page.goto("/agent-login");
  await page.getByLabel("Shared secret").fill(agentLoginSecret);
  await page.getByRole("button", { name: "Issue session" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.context().storageState({ path: storageStatePath });
});
