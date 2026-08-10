const scopes = [
  "docs",
  "web",
  "invoice-core",
  "invoice-tools",
  "mcp",
  "db",
  "env",
  "ares",
  "deps",
  "ci",
  "config",
  "release",
];

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", scopes],
    "header-max-length": [2, "always", 256],
    "body-max-line-length": [2, "always", 512],
  },
};
