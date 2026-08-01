import {
  startOfDay,
  subDays,
  subWeeks,
  subMonths,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

export type Period = "Daily" | "Weekly" | "Monthly" | "Quarterly";

export function periodToStartDate(period: Period) {
  const now = new Date();
  switch (period) {
    case "Daily":
      return startOfDay(subDays(now, 1));
    case "Weekly":
      return startOfDay(subDays(now, 7));
    case "Monthly":
      return startOfDay(subDays(now, 30));
    case "Quarterly":
      return startOfDay(subDays(now, 90));
    default:
      return startOfDay(subDays(now, 7));
  }
}

export function periodLengthDays(period: Period) {
  switch (period) {
    case "Daily":
      return 1;
    case "Weekly":
      return 7;
    case "Monthly":
      return 30;
    case "Quarterly":
      return 90;
    default:
      return 7;
  }
}

export function getPeriodRanges(period: Period) {
  const now = new Date();
  const len = periodLengthDays(period);

  // current period start
  const currentFrom = startOfDay(subDays(now, len));
  // previous period start and end
  const previousFrom = startOfDay(subDays(now, len * 2));
  const previousTo = new Date(currentFrom.getTime() - 1); // previousTo is just before currentFrom

  return { currentFrom, previousFrom, previousTo };
}

// returns number (rounded) or null when previous === 0 && current > 0
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    if (current === 0) return 0; // 0 -> 0% (no change)
    return null; // no baseline; frontend should show "New"
  }
  // compute normal percent change, round to integer
  const raw = ((current - previous) / previous) * 100;
  return Math.round(raw);
}

export function getPeriodRange(period: Period) {
  const now = new Date();

  if (period === "Daily") {
    const start = startOfDay(now);
    const end = endOfDay(now);
    const prevStart = startOfDay(subDays(start, 1));
    const prevEnd = endOfDay(subDays(end, 1));
    return { start, end, prevStart, prevEnd };
  }

  if (period === "Weekly") {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    const prevStart = subWeeks(start, 1);
    const prevEnd = subWeeks(end, 1);
    return { start, end, prevStart, prevEnd };
  }

  if (period === "Monthly") {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const prevStart = subMonths(start, 1);
    const prevEnd = endOfMonth(subMonths(end, 1));
    return { start, end, prevStart, prevEnd };
  }

  // Quarterly
  const month = now.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const start = startOfMonth(new Date(now.getFullYear(), quarterStartMonth, 1));
  const end = endOfMonth(new Date(now.getFullYear(), quarterStartMonth + 2, 1));
  const prevStart = subMonths(start, 3);
  const prevEnd = endOfMonth(subMonths(end, 3));
  return { start, end, prevStart, prevEnd };
}
