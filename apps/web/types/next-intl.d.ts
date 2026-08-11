import { type Formats } from "next-intl";

import { type AppLocale } from "@/i18n/config";
import type csMessages from "@/locales/cs.json";

type Messages = typeof csMessages;

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: Messages;
    Formats: Formats;
  }
}
