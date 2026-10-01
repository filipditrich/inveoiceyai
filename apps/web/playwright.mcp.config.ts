import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/mcp-ui",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3120",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/dev-mcp-ui.mjs",
    url: "http://127.0.0.1:3120",
    reuseExistingServer: true,
  },
});
