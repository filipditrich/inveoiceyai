import { z } from "zod";

import {
  ClientSnapshotSchema,
  ClientVatIdSchema,
  IcoSchema,
} from "@invoicey/invoice-core/schema";

import { mapSidloToClientAddressParts } from "./format-address";
import type { ClientDraft, LookupAresResult } from "./types";

export const ARES_EKONOMICKE_SUBJEKTY_ORIGIN =
  "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

const AresSidloSchema = z
  .object({
    kodStatu: z.string().optional(),
    nazevUlice: z.string().optional(),
    nazevObce: z.string().optional(),
    cisloDomovni: z.number().optional(),
    cisloOrientacni: z.number().nullable().optional(),
    cisloOrientacniPismeno: z.string().nullable().optional(),
    psc: z.number().optional(),
    textovaAdresa: z.string().optional(),
  })
  .passthrough();

/** Composite subject shape from `GET ekonomické-subjekty/{ico}` (extras ignored). */
const AresEconomickySubjectBodySchema = z
  .object({
    ico: z.string(),
    obchodniJmeno: z.string().optional(),
    sidlo: AresSidloSchema.optional(),
    dic: z.string().nullable().optional(),
  })
  .passthrough();

const AresNotFoundBodySchema = z
  .object({
    kod: z.string(),
    popis: z.string().optional(),
    subKod: z.string().optional(),
  })
  .passthrough();

function trimmedString(value?: string | null): string | undefined {
  const t = typeof value === "string" ? value.trim() : undefined;
  return (t?.length ?? 0) > 0 ? t : undefined;
}

function defaultFetchSignal(): AbortSignal | undefined {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(12000);
  }
  return undefined;
}

/**
 * Loads one economic subject by IČO from ARES REST. Call from server only;
 * respects ARES acceptable use (no client-side scraping).
 */
export async function fetchAresEkonomickySubjekt(
  icoRaw: string,
  options?: RequestInit,
): Promise<LookupAresResult> {
  let icoNormalized: string;
  try {
    icoNormalized = IcoSchema.parse(icoRaw.trim());
  } catch {
    return {
      ok: false,
      kind: "invalid_ico",
      message: "IČO must be exactly 8 digits.",
    };
  }

  const signal = options?.signal ?? defaultFetchSignal();

  let response: Response;
  try {
    const url = `${ARES_EKONOMICKE_SUBJEKTY_ORIGIN}/ekonomicke-subjekty/${icoNormalized}`;
    response = await fetch(url, {
      ...options,
      signal,
      headers: {
        accept: "application/json",
        ...(options?.headers ?? {}),
      },
      /** ARES REST is publicly documented; omit credentials. */
      cache: "no-store",
    });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "ARES fetch failed.";
    return { ok: false, kind: "http_error", message, httpStatus: 0 };
  }

  if (response.status === 404) {
    const nf = await tryParseNotFoundBody(response);
    if (nf.ok && nf.val.kod === "NENALEZENO") {
      return {
        ok: false,
        kind: "not_found",
        message:
          nf.val.popis?.split("|")[0]?.trim() ??
          "Ekonomický subjekt nenalezen.",
        httpStatus: 404,
      };
    }
    const text = nf.ok ? (nf.val.popis ?? "nenalezeno") : "nenalezeno";
    return {
      ok: false,
      kind: "not_found",
      message: text,
      httpStatus: 404,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      kind: "http_error",
      message: `ARES vrátilo HTTP ${response.status}.`,
      httpStatus: response.status,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      kind: "invalid_response",
      message: "ARES vrátilo neplatný JSON.",
      httpStatus: response.status,
    };
  }

  const parsed = AresEconomickySubjectBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "invalid_response",
      message: "Tělo odpovědi ARES neodpovídá očekávanému tvaru.",
      httpStatus: response.status,
    };
  }

  const name = trimmedString(parsed.data.obchodniJmeno);
  if (!parsed.data.sidlo || !name) {
    return {
      ok: false,
      kind: "invalid_response",
      message: "ARES vrátilo subjekt bez obchodního jména nebo adresy sídla.",
      httpStatus: response.status,
    };
  }

  const addressParts = mapSidloToClientAddressParts(parsed.data.sidlo);
  if (!addressParts) {
    return {
      ok: false,
      kind: "invalid_response",
      message:
        "Adresu sídla z ARES se nepodařilo zrekonstruovat (chybějící pole).",
      httpStatus: response.status,
    };
  }

  const dicParsed = trimmedString(parsed.data.dic ?? undefined);
  let dicSafe: ClientDraft["dic"];
  if (dicParsed) {
    const d = ClientVatIdSchema.safeParse(dicParsed);
    dicSafe = d.success ? d.data : undefined;
  }

  const snap = ClientSnapshotSchema.omit({ id: true }).safeParse({
    name,
    ico: IcoSchema.parse(trimmedString(parsed.data.ico) ?? icoNormalized),
    dic: dicSafe,
    address: addressParts,
    contactEmail: undefined,
  });

  if (!snap.success) {
    return {
      ok: false,
      kind: "invalid_response",
      message: snap.error.message,
      httpStatus: response.status,
    };
  }

  return {
    ok: true,
    draft: snap.data as ClientDraft,
  };
}

async function tryParseNotFoundBody(
  response: Response,
): Promise<
  { ok: true; val: z.infer<typeof AresNotFoundBodySchema> } | { ok: false }
> {
  try {
    const body = await response.json();
    const parsed = AresNotFoundBodySchema.safeParse(body);
    return parsed.success ? { ok: true, val: parsed.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}
