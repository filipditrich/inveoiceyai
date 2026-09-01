"use server";

import { isAppLocale, LOCALE_COOKIE, type AppLocale } from "@/i18n/config";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/** Persist UI locale preference (no URL prefix). */
export async function setLocale(locale: AppLocale): Promise<void> {
  if (!isAppLocale(locale)) {
    return;
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
