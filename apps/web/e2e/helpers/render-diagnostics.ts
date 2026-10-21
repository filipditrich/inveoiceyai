import type { Page, TestInfo } from "@playwright/test";

async function collectRenderEvidence(page: Page) {
  try {
    return await page.evaluate(() => {
      const selectors = [
        "html",
        "body",
        "h1",
        '[aria-label="Key formats"]',
        '[aria-label="Klíčové formáty"]',
        '[class*="trustItem"]',
        '[data-testid="consent-banner-reject-button"]',
      ];
      return {
        path: location.pathname,
        readyState: document.readyState,
        fonts: document.fonts.status,
        viewport: { width: innerWidth, height: innerHeight },
        elements: selectors.flatMap((selector) =>
          Array.from(document.querySelectorAll(selector)).map((element) => {
            const style = getComputedStyle(element);
            const bounds = element.getBoundingClientRect();
            return {
              selector,
              classes: element.className,
              color: style.color,
              background: style.backgroundColor,
              foregroundToken: style.getPropertyValue("--foreground"),
              backgroundToken: style.getPropertyValue("--background"),
              colorScheme: style.colorScheme,
              display: style.display,
              visibility: style.visibility,
              transition: style.transition,
              bounds: {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
              },
            };
          }),
        ),
        styleSheets: Array.from(document.styleSheets, (sheet) => ({
          href: sheet.href,
          disabled: sheet.disabled,
          media: sheet.media.mediaText,
        })),
      };
    });
  } catch (error) {
    return {
      diagnosticError: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Preserve rendered theme evidence that DOM snapshots alone do not record. */
export async function attachRenderDiagnostics(page: Page, testInfo: TestInfo) {
  if (testInfo.status === testInfo.expectedStatus) return;
  const evidence = await collectRenderEvidence(page);
  await testInfo.attach("render-diagnostics", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
}
