import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let directory: string;
let bundle: string;
test.beforeAll(() => {
  directory = mkdtempSync(path.join(tmpdir(), "invoicey-copy-"));
  const output = path.join(directory, "fixture.js");
  execFileSync(
    "bun",
    [
      "build",
      "e2e/fixtures/payment-copy.tsx",
      "--target=browser",
      "--minify",
      '--define=process.env.NODE_ENV="production"',
      `--outfile=${output}`,
    ],
    { cwd: process.cwd() },
  );
  bundle = readFileSync(output, "utf8");
});
test.afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

for (const locale of ["cs", "en"] as const) {
  for (const mode of ["success", "denied", "missing"] as const) {
    test(`payment details handle ${mode} clipboard access in ${locale}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const messages = JSON.parse(
        readFileSync(
          path.join(process.cwd(), `locales/${locale}.json`),
          "utf8",
        ),
      );
      await page.setContent(
        '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>',
      );
      await page.evaluate(
        ({ locale, messages, mode }) => {
          window.invoiceyCopyQa = { locale, messages };
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value:
              mode === "missing"
                ? undefined
                : {
                    writeText: async (value: string) => {
                      if (mode === "denied")
                        throw new DOMException("Denied", "NotAllowedError");
                      document.body.dataset.copiedValue = value;
                    },
                  },
          });
        },
        { locale, messages, mode },
      );
      await page.addScriptTag({ content: bundle });
      await page
        .getByRole("button", { name: "Copy value", exact: true })
        .click();
      const status = page.getByRole("status");
      if (mode === "success") {
        await expect(status).toHaveText(
          locale === "en" ? "Copied" : "Zkopírováno",
        );
        await expect(page.locator("body")).toHaveAttribute(
          "data-copied-value",
          "CZ6508000000192000145399",
        );
        await page.getByLabel("Value", { exact: true }).fill("1234567890/0800");
        await expect(status).toBeEmpty();
        await page
          .getByRole("button", { name: "Copy value", exact: true })
          .click();
        await expect(page.locator("body")).toHaveAttribute(
          "data-copied-value",
          "1234567890/0800",
        );
      } else {
        await expect(status).toHaveText(
          locale === "en"
            ? "Couldn’t copy. Select the value and copy it manually."
            : "Kopírování se nezdařilo. Označte údaj a zkopírujte ho ručně.",
        );
        await expect(page.locator("dd")).toHaveText("CZ6508000000192000145399");
        const selected = await page.locator("dd").evaluate((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          return selection?.toString();
        });
        expect(selected).toBe("CZ6508000000192000145399");
        await expect(
          page.getByRole("button", { name: "Copy value", exact: true }),
        ).toBeEnabled();
      }
      expect(errors).toEqual([]);
    });
  }
}
