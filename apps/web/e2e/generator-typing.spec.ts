import { expect, test } from "@playwright/test";

for (const locale of ["en", "cs"] as const) {
  // Production bug: a controlled-value render trimmed each new separator before
  // the following word was typed, joining names, addresses and descriptions.
  test(`${locale} typing keeps word separators and note line breaks`, async ({
    context,
    page,
  }, testInfo) => {
    await context.addCookies([
      {
        name: "NEXT_LOCALE",
        value: locale,
        url: testInfo.project.use.baseURL!,
      },
    ]);
    await page.route("**/api/generator/ares/**", (route) =>
      route.fulfill({ status: 404, json: { ok: false } }),
    );
    await page.goto("/free-invoice-generator");
    const description = page.getByRole("textbox", {
      name: locale === "en" ? "DESCRIPTION" : "POPIS",
      exact: true,
    });
    await expect(description).toBeAttached();
    const edit = page.getByRole("button", {
      name: locale === "en" ? "Tap to edit" : "Ťukněte pro úpravy",
      exact: true,
    });
    if (await edit.isVisible()) await edit.click();
    const cases = [
      { input: description, value: "Design work today" },
      {
        input: page.getByRole("textbox", {
          name: locale === "en" ? "SUPPLIER" : "DODAVATEL",
          exact: true,
        }),
        value: "Creative Studio Team",
      },
      {
        input: page.locator('[data-look-block="issuer"]').getByRole("textbox", {
          name: locale === "en" ? "Street and number" : "Ulice a číslo",
          exact: true,
        }),
        value: "Main Street 14",
      },
      {
        input: page.locator('[data-look-block="client"]').getByRole("textbox", {
          name: locale === "en" ? "City" : "Město",
          exact: true,
        }),
        value: "New Town",
      },
      {
        input: page.getByRole("textbox", {
          name: locale === "en" ? "U." : "J.",
          exact: true,
        }),
        value: "work day",
      },
      {
        input: page.getByRole("textbox", {
          name: locale === "en" ? "Notes" : "Poznámka",
          exact: true,
        }),
        value: "Thank you\nNext steps",
      },
    ];
    for (const { input, value } of cases) {
      await input.fill("");
      await input.pressSequentially(value, { delay: 15 });
      await expect(input).toHaveValue(value);
    }
    await page.reload();
    for (const { input, value } of cases)
      await expect(input).toHaveValue(value);
  });
}
