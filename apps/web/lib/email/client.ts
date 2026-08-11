import "server-only";

import { Resend } from "resend";

import { env } from "@invoicey/env/server";

let client: Resend | null = null;

/** Resend SDK singleton; null when `RESEND_API_KEY` is unset. */
export function getResendClient(): Resend | null {
  const key = env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) {
    client = new Resend(key);
  }
  return client;
}
