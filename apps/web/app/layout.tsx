import { env } from "@/env.config.server";
import { toOgLocale } from "@/i18n/config";
import { appFormats } from "@/i18n/formats";
import { NextIntlClientProvider } from "next-intl";
import {
  getLocale,
  getMessages,
  getNow,
  getTranslations,
  getTimeZone,
} from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";

import Providers from "./providers";
import type { AppLocale } from "@/i18n/config";
import type { Metadata } from "next";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("App.meta");
  return {
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    title: {
      default: t("title"),
      template: `%s — ${t("title")}`,
    },
    description: t("description"),
    applicationName: t("title"),
    category: "business",
    openGraph: {
      type: "website",
      locale: toOgLocale(locale),
      siteName: t("title"),
      title: t("title"),
      description: t("description"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/brand/invoicey-logo-192.png", type: "image/png" }],
      apple: [{ url: "/apple-icon.png", type: "image/png" }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const timeZone = await getTimeZone();
  const now = await getNow();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="bg-background font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        <NextIntlClientProvider
          formats={appFormats}
          locale={locale}
          messages={messages}
          now={now}
          timeZone={timeZone}
        >
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
