/** How far back the year dropdown reaches, including the current year. */
export const DASHBOARD_YEAR_SPAN = 10;

export type DashboardPeriod =
  | { kind: "year"; year: number }
  | { kind: "rolling12" }
  | { kind: "all" };

export type DashboardPeriodWindow = {
  /** Inclusive YYYY-MM-DD; omitted when the period is unbounded. */
  from?: string;
  to?: string;
  /** Month keys the issued-vs-paid chart shows, oldest first. */
  chartKeys: string[];
};

function currentYear(todayIso: string): number {
  return Number(todayIso.slice(0, 4));
}

function currentMonth(todayIso: string): number {
  return Number(todayIso.slice(5, 7));
}

function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

function monthKeysFrom(year: number, month: number, count: number): string[] {
  const keys: string[] = [];
  let y = year;
  let m = month;
  for (let i = 0; i < count; i++) {
    keys.push(`${y}-${padMonth(m)}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function rollingMonthsEndingOn(todayIso: string, count: number): string[] {
  let year = currentYear(todayIso);
  let month = currentMonth(todayIso) - (count - 1);
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  return monthKeysFrom(year, month, count);
}

function isCalendarYear(raw: string): boolean {
  if (!/^\d{4}$/.test(raw)) return false;
  const year = Number(raw);
  return year >= 2000 && year <= 2100;
}

/** Parse `?period=` — missing or junk values mean the current calendar year. */
export function parseDashboardPeriod(
  raw: string | undefined,
  todayIso: string,
): DashboardPeriod {
  if (raw === "12m") return { kind: "rolling12" };
  if (raw === "all") return { kind: "all" };
  if (raw && isCalendarYear(raw)) {
    return { kind: "year", year: Number(raw) };
  }
  return { kind: "year", year: currentYear(todayIso) };
}

export function serializeDashboardPeriod(period: DashboardPeriod): string {
  if (period.kind === "year") return String(period.year);
  if (period.kind === "rolling12") return "12m";
  return "all";
}

export function dashboardPeriodWindow(
  period: DashboardPeriod,
  todayIso: string,
): DashboardPeriodWindow {
  if (period.kind === "all") {
    return { chartKeys: rollingMonthsEndingOn(todayIso, 12) };
  }
  if (period.kind === "rolling12") {
    const chartKeys = rollingMonthsEndingOn(todayIso, 12);
    return {
      from: `${chartKeys[0]}-01`,
      to: todayIso,
      chartKeys,
    };
  }
  const throughMonth =
    period.year === currentYear(todayIso) ? currentMonth(todayIso) : 12;
  return {
    from: `${period.year}-01-01`,
    to: `${period.year}-12-31`,
    chartKeys: monthKeysFrom(period.year, 1, throughMonth),
  };
}

/** Values for the period <select>, newest year first. */
export function dashboardPeriodValues(
  todayIso: string,
  selectedYear?: number,
): string[] {
  const year = currentYear(todayIso);
  const years = new Set(
    Array.from({ length: DASHBOARD_YEAR_SPAN }, (_, i) => year - i),
  );
  if (selectedYear) years.add(selectedYear);
  const yearValues = [...years].sort((a, b) => b - a).map(String);
  return [...yearValues, "12m", "all"];
}
