const DECIMAL_RE = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/u;

export function decimalToMinor(value: string): bigint {
  const match = DECIMAL_RE.exec(value.trim());
  if (!match) {
    throw new Error(`invalid_money:${value}`);
  }
  const sign = match[1] === "-" ? -BigInt(1) : BigInt(1);
  const whole = BigInt(match[2] ?? "0");
  const frac = (match[3] ?? "").padEnd(2, "0").slice(0, 2);
  return sign * (whole * BigInt(100) + BigInt(frac || "0"));
}

export function minorToDecimal(value: bigint): string {
  const sign = value < BigInt(0) ? "-" : "";
  const abs = value < BigInt(0) ? -value : value;
  const whole = abs / BigInt(100);
  const frac = (abs % BigInt(100)).toString().padStart(2, "0");
  return `${sign}${whole.toString()}.${frac}`;
}
