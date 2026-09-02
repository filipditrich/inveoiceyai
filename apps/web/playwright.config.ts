import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.INVOICEY_E2E_PORT ?? 3_000);
const baseURL = `http://localhost:${port}`;
const authStorageState = process.env.INVOICEY_E2E_AUTH_STORAGE_STATE;
const createsAgentSession = Boolean(
  authStorageState && process.env.INVOICEY_AGENT_LOGIN_SECRET,
);

const authenticatedProject = {
  dependencies: createsAgentSession ? ["auth-setup"] : [],
  testIgnore: /auth\.setup\.ts/,
  use: authStorageState ? { storageState: authStorageState } : {},
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    ...(createsAgentSession
      ? [
          {
            name: "auth-setup",
            testMatch: /auth\.setup\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
    {
      name: "chromium",
      ...authenticatedProject,
      use: {
        ...devices["Desktop Chrome"],
        ...authenticatedProject.use,
      },
    },
    {
      name: "mobile-chromium",
      ...authenticatedProject,
      use: { ...devices["Pixel 7"], ...authenticatedProject.use },
    },
  ],
  webServer: {
    command: process.env.INVOICEY_E2E_NODE_24
      ? `NODE_ENV=development ${process.env.INVOICEY_E2E_NODE_24} node_modules/next/dist/bin/next dev --webpack --port ${port}`
      : `NODE_ENV=development bun run dev --port ${port}`,
    cwd: process.cwd(),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
