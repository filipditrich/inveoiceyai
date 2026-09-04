import { resolve4, resolve6, resolveMx } from "node:dns/promises";
import { z } from "zod";

import { DISPOSABLE_DOMAINS } from "./disposable-domains";

const GuestEmailSchema = z.string().trim().toLowerCase().email();

const MX_TIMEOUT_MS = 3_000;

export type GuestEmailCheck =
  | { ok: true; email: string; domain: string }
  | { ok: false; reason: "invalid" | "disposable" | "undeliverable" };

export function normalizeGuestEmail(raw: string): string | null {
  const parsed = GuestEmailSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.trim().toLowerCase());
}

function isMissingDns(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === "ENOTFOUND" || code === "ENODATA" || code === "NODATA";
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * MX first, then A/AAAA — some domains accept mail on an address record.
 * Fail open on timeouts and unexpected resolver errors: a flaky DNS must
 * not cost a lead (ADR 0048 §8).
 */
export async function hasMailExchanger(domain: string): Promise<boolean> {
  try {
    const mx = await withTimeout(resolveMx(domain), MX_TIMEOUT_MS);
    if (mx.length > 0) return true;
  } catch (error) {
    if (isMissingDns(error)) {
      // fall through to A/AAAA
    } else {
      return true;
    }
  }

  try {
    const a = await withTimeout(resolve4(domain), MX_TIMEOUT_MS);
    if (a.length > 0) return true;
  } catch (error) {
    if (!isMissingDns(error)) return true;
  }

  try {
    const aaaa = await withTimeout(resolve6(domain), MX_TIMEOUT_MS);
    return aaaa.length > 0;
  } catch (error) {
    if (isMissingDns(error)) return false;
    return true;
  }
}

export async function checkGuestEmail(raw: string): Promise<GuestEmailCheck> {
  const email = normalizeGuestEmail(raw);
  if (!email) return { ok: false, reason: "invalid" };
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (!domain) return { ok: false, reason: "invalid" };
  if (isDisposableDomain(domain)) return { ok: false, reason: "disposable" };
  if (!(await hasMailExchanger(domain))) {
    return { ok: false, reason: "undeliverable" };
  }
  return { ok: true, email, domain };
}
