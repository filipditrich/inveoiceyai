import messages from "@/locales/en.json";
import { type AppConfig, NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { WelcomeMigrateStep } from "./issuer-welcome-steps";

it("offers the history skip before the long provider list", () => {
  // SAFETY: Catalogs share keys; next-intl derives literal message values from Czech.
  const englishMessages = messages as AppConfig["Messages"];
  const html = renderToStaticMarkup(
    <NextIntlClientProvider
      locale="en"
      timeZone="UTC"
      messages={englishMessages}
    >
      <WelcomeMigrateStep onSkip={() => {}} />
    </NextIntlClientProvider>,
  );
  expect(html.indexOf("Skip for now")).toBeGreaterThanOrEqual(0);
  expect(html.indexOf("Skip for now")).toBeLessThan(html.indexOf("Fakturoid"));
});
