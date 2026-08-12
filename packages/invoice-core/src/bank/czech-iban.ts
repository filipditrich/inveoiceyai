const CZ_ACCOUNT_RE = /^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/u;
const CZ_IBAN_RE = /^CZ\d{22}$/u;

export function parseCzAccountParts(canonical: string): {
  prefix: string;
  number: string;
  bankCode: string;
} {
  const m = CZ_ACCOUNT_RE.exec(canonical.trim());
  if (!m) {
    throw new Error(`invalid Czech account number: ${canonical}`);
  }
  return {
    prefix: m[1] ?? "",
    number: m[2]!,
    bankCode: m[3]!,
  };
}

/** BBAN = bank(4) + prefix(6) + account(10). */
export function czechAccountToBban(accountNumber: string): string {
  const { prefix, number, bankCode } = parseCzAccountParts(accountNumber);
  return `${bankCode}${prefix.padStart(6, "0")}${number.padStart(10, "0")}`;
}

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

/** Czech account number (prefix-number/bank) → IBAN. */
export function czechAccountToIban(accountNumber: string): string {
  const bban = czechAccountToBban(accountNumber);
  /** CZ → 1235, check digits as 00 */
  const check = 98 - mod97(`${bban}123500`);
  const checkDigits = String(check).padStart(2, "0");
  return `CZ${checkDigits}${bban}`;
}

export function isValidCzIban(iban: string): boolean {
  const normalized = iban.replace(/\s+/gu, "").toUpperCase();
  if (!CZ_IBAN_RE.test(normalized)) {
    return false;
  }
  const rearranged = `${normalized.slice(4)}${normalized.slice(0, 4)}`;
  try {
    return mod97(lettersToDigits(rearranged)) === 1;
  } catch {
    return false;
  }
}

export function czIbanMatchesAccount(
  iban: string,
  accountNumber: string,
): boolean {
  const normalized = iban.replace(/\s+/gu, "").toUpperCase();
  if (!isValidCzIban(normalized)) {
    return false;
  }
  try {
    return normalized.slice(4) === czechAccountToBban(accountNumber);
  } catch {
    return false;
  }
}

export function suggestCzIban(accountNumber: string): string | null {
  try {
    return czechAccountToIban(accountNumber.trim());
  } catch {
    return null;
  }
}
