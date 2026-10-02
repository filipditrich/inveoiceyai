import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/mcp-oauth",
  testMatch: "*.spec.ts",
  workers: 1,
  use: { baseURL: "http://localhost:3123", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "bun run --cwd tests/mcp-oauth/site dev",
    url: "http://localhost:3123",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
