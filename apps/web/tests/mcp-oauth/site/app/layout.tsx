import { NextIntlClientProvider } from "next-intl";

import messages from "../../../../locales/en.json";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextIntlClientProvider locale="en" messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
