/** Look up a catalog leaf by runtime key without breaking next-intl typed keys. */
export function messageLookup<T extends Record<string, string>>(
  table: T,
  key: string,
  fallback?: string,
): string {
  if (Object.hasOwn(table, key)) {
    return table[key as keyof T];
  }
  return fallback ?? key.replaceAll("_", " ");
}
