/** `sidlo.psc` is numeric; snapshot expects `981 06` style. */
export function formatCzPostcodeFromNumber(psc: number): string {
  const s = String(Math.max(0, Math.floor(psc))).padStart(5, "0");
  if (s.length > 5) {
    return `${s.slice(0, 3)} ${s.slice(-2)}`;
  }
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

export interface AresSidloLike {
  readonly kodStatu?: string;
  readonly nazevUlice?: string;
  readonly cisloDomovni?: number;
  readonly cisloOrientacni?: number | null;
  readonly cisloOrientacniPismeno?: string | null;
  readonly nazevObce?: string;
  readonly psc?: number;
  readonly textovaAdresa?: string;
}

export interface ClientAddressParts {
  street: string;
  city: string;
  zip: string;
  country: string;
}

function buildStreetLine(sidlo: AresSidloLike): string | undefined {
  const street = sidlo.nazevUlice?.trim();
  const no = sidlo.cisloDomovni;

  if (!street || no === undefined || Number.isNaN(no)) {
    return sidlo.textovaAdresa?.split(",")[0]?.trim();
  }

  const orient =
    sidlo.cisloOrientacni != null && sidlo.cisloOrientacni !== undefined
      ? `/${sidlo.cisloOrientacni}${sidlo.cisloOrientacniPismeno ?? ""}`
      : "";
  return `${street} ${no}${orient}`.trim();
}

function normalizeCountry(raw?: string): string {
  const t = raw?.trim();
  if (!t) return "CZ";
  if (/^[A-Z]{2}$/u.test(t)) return t;
  const lower = t.toLocaleLowerCase("cs");
  if (
    lower === "česká republika" ||
    lower === "ceska republika" ||
    lower === "czech republic" ||
    lower === "czechia"
  ) {
    return "CZ";
  }
  return "CZ";
}

/**
 * Parse a free-text Czech address into snapshot fields.
 * Supports ARES `textovaAdresa` and Slack flat strings like
 * `Opletalova 1410, Praha 1, 110 00`.
 */
export function parseCzAddressText(raw: string): ClientAddressParts | null {
  const segments = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  const street = segments[0] ?? "";
  if (!street) return null;

  const rest = segments.slice(1);
  let zip = "";
  let city = "";

  const pureZipIdx = rest.findIndex((s) => /^\d{3}\s?\d{2}$/u.test(s));
  if (pureZipIdx >= 0) {
    const m = rest[pureZipIdx]!.match(/^(\d{3})\s?(\d{2})$/u)!;
    zip = `${m[1]} ${m[2]}`;
    city =
      rest.slice(0, pureZipIdx).join(", ") ||
      rest.slice(pureZipIdx + 1).join(", ");
  } else {
    for (const seg of rest) {
      /** ARES style: `11000 Praha 1` */
      const start = seg.match(/^(\d{3})\s?(\d{2})\s+(.+)$/u);
      if (start) {
        zip = `${start[1]} ${start[2]}`;
        city = start[3]!.trim();
        break;
      }
    }
    if (!zip) {
      const joined = rest.join(", ");
      const any = joined.match(/\b(\d{3})\s?(\d{2})\b/u);
      if (any) {
        zip = `${any[1]} ${any[2]}`;
        city = joined
          .replace(/\s*\d{3}\s?\d{2}\s*/u, " ")
          .replace(/^,\s*|,\s*$/gu, "")
          .replace(/\s+/gu, " ")
          .trim();
      } else {
        city = joined;
      }
    }
  }

  city = city.replace(/^,\s*|,\s*$/gu, "").trim();
  if (!street || !city || !zip) return null;
  return { street, city, zip, country: "CZ" };
}

/** Map primary seat from ARES to `ClientAddressSchema`-compatible fields. */
export function mapSidloToClientAddressParts(
  sidlo: AresSidloLike,
): ClientAddressParts | null {
  const structuredStreet = buildStreetLine(sidlo);
  const postal =
    sidlo.psc !== undefined &&
    sidlo.psc !== null &&
    typeof sidlo.psc === "number" &&
    !Number.isNaN(sidlo.psc)
      ? formatCzPostcodeFromNumber(sidlo.psc)
      : undefined;
  const obecTrim = sidlo.nazevObce?.trim();
  const structuredCityInitial =
    obecTrim !== undefined && obecTrim.length > 0 ? obecTrim : "";

  let street = structuredStreet ?? "";
  let city = structuredCityInitial;
  let zip = postal ?? "";

  if (!street || !city || !zip) {
    const tv = sidlo.textovaAdresa?.trim();
    if (tv) {
      const parsed = parseCzAddressText(tv);
      if (parsed) {
        street ||= parsed.street;
        city ||= parsed.city;
        zip ||= parsed.zip;
      }
    }
  }

  const country = normalizeCountry(sidlo.kodStatu);

  if (!street || !city || !zip || !country) {
    return null;
  }

  return { street, city, zip, country };
}
