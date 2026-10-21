import { expect, test } from "@playwright/test";

for (const locale of ["en", "cs"] as const) {
  // A failed refresh left the preceding preview URL available, so users could
  // open a PDF with outdated line items after editing the draft.
  test(`${locale} failed preview refresh removes the older PDF and explains recovery`, async ({
    page,
    context,
  }, testInfo) => {
    await context.addCookies([
      {
        name: "NEXT_LOCALE",
        value: locale,
        url: testInfo.project.use.baseURL!,
      },
    ]);
    const labels =
      locale === "en"
        ? {
            preview: "See real PDF preview",
            open: "Open PDF",
            close: "Close",
            description: "DESCRIPTION",
            edit: "Tap to edit",
            error: "We couldn’t build the preview. Close it and try again.",
          }
        : {
            preview: "Zobrazit opravdové PDF",
            open: "Otevřít PDF",
            close: "Zavřít",
            description: "POPIS",
            edit: "Ťukněte pro úpravy",
            error:
              "Náhled se nepodařilo vytvořit. Zavřete ho a zkuste to znovu.",
          };
    const requests: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/demo/invoice-pdf", async (route) => {
      requests.push(route.request().postData() ?? "");
      if (requests.length === 2) {
        await route.fulfill({
          status: 503,
          json: { error: "preview_unavailable" },
        });
        return;
      }
      // Only the preview lifecycle is under test; this fixture is never issued or emailed.
      await route.fulfill({
        contentType: "application/pdf",
        body: "%PDF-1.4\n%%EOF\n",
      });
    });
    await page.goto("/free-invoice-generator");
    const description = page.getByRole("textbox", {
      name: labels.description,
      exact: true,
    });
    await expect(description).toBeAttached();
    const preview = page.getByRole("button", {
      name: labels.preview,
      exact: true,
    });
    const dialog = page.getByRole("dialog", {
      name: labels.preview,
      exact: true,
    });
    await preview.click();
    await expect(
      dialog.getByRole("link", { name: labels.open, exact: true }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: labels.close, exact: true })
      .click();
    const edit = page.getByRole("button", { name: labels.edit, exact: true });
    if (await edit.isVisible()) await edit.click();
    await description.fill("Changed preview work");
    await preview.click();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: labels.open, exact: true }),
    ).toHaveCount(0);
    await expect(dialog.getByText(labels.error, { exact: true })).toBeVisible();
    await expect(dialog.getByText(labels.error, { exact: true })).toHaveCSS(
      "white-space",
      "normal",
    );
    await expect(dialog.getByRole("alert")).toHaveText(labels.error);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toContain("Changed preview work");
    await dialog
      .getByRole("button", { name: labels.close, exact: true })
      .click();
    await expect(description).toHaveValue("Changed preview work");
    await preview.click();
    await expect(
      dialog.getByRole("link", { name: labels.open, exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    expect(requests).toHaveLength(3);
    expect(errors).toEqual([]);
  });
}
