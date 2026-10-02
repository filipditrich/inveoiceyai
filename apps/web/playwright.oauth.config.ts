import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/mcp-oauth",
  testMatch: "*.spec.ts",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  use: { baseURL: "http://localhost:3123", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "NODE_ENV=development bun run --cwd tests/mcp-oauth/site dev",
    url: "http://localhost:3123",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
