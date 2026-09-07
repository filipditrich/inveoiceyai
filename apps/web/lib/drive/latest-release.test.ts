import { describe, expect, it, vi } from "vitest";

import {
  INVOICEY_DRIVE_GITHUB_REPO,
  loadGithubLatestRelease,
  normalizeReleaseVersion,
  resolveDriveLatestRelease,
} from "./latest-release";

describe("normalizeReleaseVersion", () => {
  it("strips a leading v and whitespace", () => {
    expect(normalizeReleaseVersion("v0.1.4")).toBe("0.1.4");
    expect(normalizeReleaseVersion(" V0.1.10 ")).toBe("0.1.10");
    expect(normalizeReleaseVersion("0.1.4")).toBe("0.1.4");
  });

  it("keeps the x.y.z core and drops a pre-release suffix", () => {
    expect(normalizeReleaseVersion("v1.0.0-beta.1")).toBe("1.0.0");
  });

  it("rejects empty or non-semver tags", () => {
    expect(normalizeReleaseVersion("")).toBeNull();
    expect(normalizeReleaseVersion("latest")).toBeNull();
    expect(normalizeReleaseVersion("v")).toBeNull();
  });
});

describe("resolveDriveLatestRelease", () => {
  const github = {
    version: "0.1.4",
    dmgUrl:
      "https://github.com/filipditrich/invoicey-mac/releases/download/v0.1.4/InvoiceyDrive.dmg",
  };

  it("prefers configured dmg url and github version", () => {
    expect(
      resolveDriveLatestRelease({
        configuredDmgUrl:
          "https://github.com/filipditrich/invoicey-mac/releases/latest/download/InvoiceyDrive.dmg",
        github,
      }),
    ).toEqual({
      version: "0.1.4",
      dmgUrl:
        "https://github.com/filipditrich/invoicey-mac/releases/latest/download/InvoiceyDrive.dmg",
    });
  });

  it("uses a configured version when github is down", () => {
    expect(
      resolveDriveLatestRelease({
        configuredVersion: "v0.1.5",
        configuredDmgUrl: "https://example.com/InvoiceyDrive.dmg",
        github: null,
      }),
    ).toEqual({
      version: "0.1.5",
      dmgUrl: "https://example.com/InvoiceyDrive.dmg",
    });
  });

  it("falls back to the github asset when no dmg env is set", () => {
    expect(resolveDriveLatestRelease({ github })).toEqual({
      version: "0.1.4",
      dmgUrl: github.dmgUrl,
    });
  });

  it("returns null when there is no version to compare", () => {
    expect(
      resolveDriveLatestRelease({
        configuredDmgUrl: "https://example.com/InvoiceyDrive.dmg",
        github: null,
      }),
    ).toBeNull();
  });
});

describe("loadGithubLatestRelease", () => {
  it("reads tag_name and the InvoiceyDrive.dmg asset", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tag_name: "v0.1.4",
          assets: [
            {
              name: "notes.txt",
              browser_download_url: "https://example.com/notes.txt",
            },
            {
              name: "InvoiceyDrive.dmg",
              browser_download_url:
                "https://github.com/filipditrich/invoicey-mac/releases/download/v0.1.4/InvoiceyDrive.dmg",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(loadGithubLatestRelease(fetchImpl)).resolves.toEqual({
      version: "0.1.4",
      dmgUrl:
        "https://github.com/filipditrich/invoicey-mac/releases/download/v0.1.4/InvoiceyDrive.dmg",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://api.github.com/repos/${INVOICEY_DRIVE_GITHUB_REPO}/releases/latest`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/vnd.github+json",
        }),
      }),
    );
  });

  it("returns null when github is unavailable", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 403 }));
    await expect(loadGithubLatestRelease(fetchImpl)).resolves.toBeNull();
  });
});
