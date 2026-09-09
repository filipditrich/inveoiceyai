export const PAYMENTS_PAGE_SIZE = 10;

export type PageSlice = {
  page: number;
  pageCount: number;
  offset: number;
  limit: number;
  from: number;
  to: number;
};

export type IncomingStateFilter = "all" | "unmatched" | "allocated";
export type RequestStatusFilter = "all" | "open" | "settled" | "cancelled";

export function parseIncomingState(
  raw: string | undefined,
): IncomingStateFilter {
  if (raw === "unmatched" || raw === "allocated") return raw;
  return "all";
}

export function parseRequestStatus(
  raw: string | undefined,
): RequestStatusFilter {
  if (raw === "open" || raw === "settled" || raw === "cancelled") return raw;
  return "all";
}

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

export function pageSlice(
  total: number,
  page: number,
  size = PAYMENTS_PAGE_SIZE,
): PageSlice {
  const pageCount = Math.max(1, Math.ceil(total / size) || 1);
  const safePage = Math.min(Math.max(page, 1), pageCount);
  return {
    page: safePage,
    pageCount,
    offset: (safePage - 1) * size,
    limit: size,
    from: total === 0 ? 0 : (safePage - 1) * size + 1,
    to: Math.min(safePage * size, total),
  };
}

export function paymentsSearchHref(
  path: string,
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (
      key === "toast" ||
      value === undefined ||
      value === "" ||
      value === "1"
    ) {
      continue;
    }
    params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
