/** Czech IČO weighted checksum (mod 11, mapped onto a single digit). */
export function isValidCzIco(ico: string): boolean {
  const digits = ico.replaceAll(/\D/g, "");
  if (!/^\d{8}$/u.test(digits)) {
    return false;
  }
  const weights = [8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i += 1) {
    sum += Number(digits[i]) * weights[i]!;
  }
  const check = (11 - (sum % 11)) % 10;
  return check === Number(digits[7]);
}

export function normalizeIcoDigits(
  ico: string | null | undefined,
): string | undefined {
  if (!ico) {
    return undefined;
  }
  const digits = ico.replaceAll(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}
