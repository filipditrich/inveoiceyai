/** Keep browser reporting useful without exporting user or document payloads. */
export function privacySafeErrorReport(error: Error & { digest?: string }) {
  return {
    name: error.name || "Error",
    digest: error.digest ?? null,
    category: "redacted_runtime_error" as const,
  };
}

export function reportRuntimeError(error: Error & { digest?: string }) {
  console.error("[invoicey runtime error]", privacySafeErrorReport(error));
}
