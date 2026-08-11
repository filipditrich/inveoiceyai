"use client";

import {
  Filters,
  type Filter,
  type FilterFieldConfig,
  type FilterI18nConfig,
} from "@/components/reui/filters";

export const FILTERS_CS: Partial<FilterI18nConfig> = {
  addFilter: "Přidat filtr",
  searchFields: "Hledat pole…",
  noFieldsFound: "Žádná pole",
  noResultsFound: "Nic nenalezeno",
  select: "Vybrat",
  addFilterTitle: "Přidat filtr",
};

type AppFiltersProps<T = string> = {
  fields: FilterFieldConfig<T>[];
  filters: Filter<T>[];
  onChange: (filters: Filter<T>[]) => void;
  className?: string;
  size?: "sm" | "default" | "lg";
};

export function AppFilters<T = string>({
  fields,
  filters,
  onChange,
  className,
  size = "sm",
}: AppFiltersProps<T>) {
  return (
    <Filters
      className={className}
      fields={fields}
      filters={filters}
      i18n={FILTERS_CS}
      onChange={onChange}
      size={size}
      variant="default"
    />
  );
}

/** Build initial Filter chips from a flat key→value map (single-value fields). */
export function filtersFromRecord<T = string>(
  values: Record<string, string | undefined | null>,
  fields: FilterFieldConfig<T>[],
): Filter<T>[] {
  const fieldKeys = new Set(
    fields.map((f) => f.key).filter((k): k is string => Boolean(k)),
  );
  const out: Filter<T>[] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!raw || !fieldKeys.has(key)) {
      continue;
    }
    const field = fields.find((f) => f.key === key);
    const operator =
      field?.defaultOperator ?? (field?.type === "text" ? "contains" : "is");
    out.push({
      id: `url-${key}`,
      field: key,
      operator,
      values: [raw as T],
    });
  }
  return out;
}

/** Flatten Filter chips back to a single string per field (last value wins). */
export function recordFromFilters(
  filters: Filter<string>[],
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const f of filters) {
    const v = f.values[0];
    out[f.field] = v != null && String(v).length > 0 ? String(v) : undefined;
  }
  return out;
}
