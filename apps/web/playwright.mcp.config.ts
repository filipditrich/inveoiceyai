import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/mcp-ui",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  use: {
    baseURL: process.env.MCP_UI_BASE_URL ?? "http://127.0.0.1:3120",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
