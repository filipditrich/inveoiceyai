export function normalizeFioError(error: unknown): string {
  const message = error instanceof Error ? error.message : "fio_sync_failed";
  if (/authenticate|token inactive|token.*invalid/iu.test(message)) {
    return "fio_token_inactive";
  }
  return message;
}
