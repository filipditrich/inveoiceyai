/** sessionId → raw device token until `hooks.after` can setCookie. */
const pending = new Map<string, string>();

export function stashPendingDeviceToken(
  sessionId: string,
  rawToken: string,
): void {
  pending.set(sessionId, rawToken);
}

export function takePendingDeviceToken(sessionId: string): string | null {
  const value = pending.get(sessionId) ?? null;
  if (value) pending.delete(sessionId);
  return value;
}
