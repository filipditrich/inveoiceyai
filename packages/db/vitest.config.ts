import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure units only — nothing here should need a database.
    include: ["src/**/*.test.ts"],
  },
});
