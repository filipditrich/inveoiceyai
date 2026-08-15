const DECIMAL_RE = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/u;

export function decimalToMinor(value: string): bigint {
  const normalized = value.trim();
  const match = DECIMAL_RE.exec(normalized);
  if (!match) {
    throw new Error(`invalid_money:${value}`);
  }
  const sign = match[1] === "-" ? BigInt(-1) : BigInt(1);
  const whole = BigInt(match[2] ?? "0");
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0"));
  return sign * (whole * BigInt(100) + fraction);
}

export function minorToDecimal(value: bigint): string {
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  const whole = absolute / BigInt(100);
  const fraction = absolute % BigInt(100);
  return `${sign}${whole}.${fraction.toString().padStart(2, "0")}`;
}

export function absoluteDecimal(value: string): string {
  const minor = decimalToMinor(value);
  return minorToDecimal(minor < BigInt(0) ? -minor : minor);
}
