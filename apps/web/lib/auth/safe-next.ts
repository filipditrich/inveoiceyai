const DEFAULT_AFTER_SIGN_IN = "/dashboard";

/** Keep post-auth navigation on this origin and away from auth loops. */
export function safeNext(value: string | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value) ||
    value.startsWith("/sign-in")
  ) {
    return DEFAULT_AFTER_SIGN_IN;
  }
  return value;
}
