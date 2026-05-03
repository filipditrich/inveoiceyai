/**
 * Parses Czech currency phrases into a non-negative CZK amount (major units).
 * Supports spaces, comma decimals (`1 000,50`), and thousand dots (`1.000,50`).
 */
export function parseAmountCz(
  input: string,
): { ok: true; amount: number } | { ok: false } {
  let s = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (s === "") {
    return { ok: false };
  }

  s = s.replace(/kč|czk|korun(y|a)?/gi, "").trim();
  s = s.replace(/\s/g, "");
  s = s.replace(/\.-/g, "").replace(/,-$/g, "").replace(/-$/, "");

  if (s === "") {
    return { ok: false };
  }

  /** comma as decimal separator (typical CZ) */
  if (/,\d{1,2}$/.test(s)) {
    const [intPart, frac] = s.split(",");
    if (!intPart) {
      return { ok: false };
    }
    const intClean = intPart.replace(/\./g, "");
    s = `${intClean}.${frac}`;
  } else {
    /** dots as thousand separators or single decimal dot */
    const dotCount = (s.match(/\./g) ?? []).length;
    if (dotCount > 1 || /^(\d{1,3})\.(\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "");
    }
    s = s.replace(/,/g, ".");
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false };
  }

  return { ok: true, amount: Math.round(n * 100) / 100 };
}
