import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";
import assert from "node:assert/strict";
import test from "node:test";

import config from "../release.config.js";

const [, notesConfig] = config.plugins.find(
  (plugin) =>
    Array.isArray(plugin) &&
    plugin[0] === "@semantic-release/release-notes-generator",
);

function notesFor(messages) {
  return generateNotes(notesConfig, {
    cwd: process.cwd(),
    commits: messages.map((message, index) => ({
      hash: `${index + 1}`.repeat(40),
      message,
    })),
    lastRelease: { gitTag: "v1.0.0" },
    nextRelease: { gitTag: "v1.0.1", version: "1.0.1" },
    options: {
      repositoryUrl: "https://github.com/filipditrich/inveoiceyai.git",
    },
  });
}

// A preset/writer API mismatch previously published headings with no changes.
test("release notes include fixes, features and documentation with commit links", async () => {
  const notes = await notesFor([
    "fix(web): recover denied clipboard writes",
    "feat(mcp): review invoice drafts",
    "docs: explain connecting ChatGPT",
  ]);
  assert.match(notes, /### Bug Fixes/);
  assert.match(notes, /recover denied clipboard writes/);
  assert.match(notes, /### Features/);
  assert.match(notes, /review invoice drafts/);
  assert.match(notes, /### Documentation/);
  assert.match(notes, /explain connecting ChatGPT/);
  assert.match(
    notes,
    /https:\/\/github.com\/filipditrich\/inveoiceyai\/commit\/1{40}/,
  );
});

test("internal maintenance does not appear in public notes", async () => {
  const notes = await notesFor([
    "fix(web): preserve payment detail feedback",
    "ci: retain browser diagnostics",
    "test: improve clipboard fixtures",
    "chore: update internal tooling",
  ]);
  assert.match(notes, /preserve payment detail feedback/);
  assert.doesNotMatch(
    notes,
    /retain browser diagnostics|improve clipboard fixtures|update internal tooling/,
  );
});

test("breaking changes remain visible even for normally hidden maintenance", async () => {
  const notes = await notesFor([
    "chore!: remove the old integration endpoint\n\nBREAKING CHANGE: Use the companion API endpoint.",
  ]);
  assert.match(notes, /BREAKING CHANGES/);
  assert.match(notes, /Use the companion API endpoint/);
});

// Both plugins share the preset; compatibility must preserve version decisions.
for (const [message, expected] of [
  ["fix(web): recover denied clipboard writes", "patch"],
  ["feat(mcp): review invoice drafts", "minor"],
  ["feat!: replace the integration endpoint", "minor"],
  ["ci: retain browser diagnostics", null],
]) {
  test(`release analysis preserves ${expected ?? "no release"} for ${message}`, async () => {
    const [, analyzerConfig] = config.plugins.find(
      (plugin) =>
        Array.isArray(plugin) &&
        plugin[0] === "@semantic-release/commit-analyzer",
    );
    const result = await analyzeCommits(analyzerConfig, {
      cwd: process.cwd(),
      commits: [{ hash: "a".repeat(40), message }],
      logger: { log() {} },
    });
    assert.equal(result, expected);
  });
}
