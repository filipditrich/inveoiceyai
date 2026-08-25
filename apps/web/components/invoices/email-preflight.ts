export type EmailPreflight = { valid: boolean; suppressed: boolean };

const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailPreflight(
  to: string,
  cc: string,
  suppressedEmails: readonly string[],
): EmailPreflight {
  const suppressed = new Set(
    suppressedEmails.map((email) => email.trim().toLowerCase()),
  );
  const recipients = [to, ...cc.split(/[,;]/)]
    .map((email) => email.trim())
    .filter(Boolean);
  return {
    valid:
      recipients.length > 0 && recipients.every((email) => pattern.test(email)),
    suppressed: recipients.some((email) => suppressed.has(email.toLowerCase())),
  };
}

export function canResendEmail(status: string): boolean {
  return ["failed", "bounced", "complained", "delayed"].includes(status);
}
