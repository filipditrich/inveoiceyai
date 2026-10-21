import { expect, test } from "@playwright/test";

for (const locale of ["cs", "en"] as const) {
  for (const mode of ["success", "denied", "missing"] as const) {
    test(`CLI install handles ${mode} clipboard in ${locale}`, async ({
      page,
      context,
      baseURL,
    }) => {
      if (!baseURL) throw new Error("Missing application URL");
      await context.addCookies([
        { name: "NEXT_LOCALE", value: locale, url: baseURL },
      ]);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript((mode) => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value:
            mode === "missing"
              ? undefined
              : {
                  writeText: async (value: string) => {
                    if (mode === "denied")
                      throw new DOMException("Denied", "NotAllowedError");
                    document.body.dataset.copiedCommand = value;
                  },
                },
        });
      }, mode);
      await page.goto("/");
      const consent = page.getByTestId("consent-banner-reject-button");
      await expect(consent).toBeVisible();
      await consent.click();
      await expect(consent).toBeHidden();
      await page
        .getByRole("button", {
          name:
            locale === "en"
              ? "Copy install command"
              : "Kopírovat instalační příkaz",
          exact: true,
        })
        .click();
      if (mode === "success") {
        await expect(
          page.getByRole("button", {
            name:
              locale === "en"
                ? "Install command copied"
                : "Instalační příkaz zkopírován",
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.locator("body")).toHaveAttribute(
          "data-copied-command",
          "curl -fsSL https://invoicey.app/install | bash",
        );
      } else {
        await expect(
          page.getByRole("status").filter({
            hasText:
              locale === "en"
                ? "Couldn’t copy the command"
                : "Příkaz se nepodařilo zkopírovat",
          }),
        ).toBeVisible();
        const command = page.locator("code").filter({
          hasText: "curl -fsSL https://invoicey.app/install | bash",
        });
        await command.focus();
        await expect(command).toBeFocused();
        const selected = await command.evaluate((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          return selection?.toString();
        });
        expect(selected).toBe("curl -fsSL https://invoicey.app/install | bash");
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
      ).toBe(false);
      expect(errors).toEqual([]);
    });
  }
}
