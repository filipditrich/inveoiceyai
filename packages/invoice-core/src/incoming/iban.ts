function mod97(digits: string): number {
  let remainder = 0;
  for (const ch of digits) {
    remainder = (remainder * 10 + (ch.charCodeAt(0) - 48)) % 97;
  }
  return remainder;
}

function lettersToDigits(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) {
      out += ch;
    } else if (code >= 65 && code <= 90) {
      out += String(code - 55);
    } else {
      throw new Error(`invalid IBAN character: ${ch}`);
    }
  }
  return out;
}

/** ISO 13616 mod-97 for any SEPA IBAN. */
export function isValidIban(iban: string): boolean {
  const normalized = iban.replaceAll(/\s+/gu, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/u.test(normalized)) {
    return false;
  }
  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  try {
    return mod97(lettersToDigits(rearranged)) === 1;
  } catch {
    return false;
  }
}

export function normalizeIban(
  iban: string | null | undefined,
): string | undefined {
  if (!iban) {
    return undefined;
  }
  const normalized = iban.replaceAll(/\s+/gu, "").toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}
