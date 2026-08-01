// lib/stats.ts
export type Period = "Daily" | "Weekly" | "Monthly" | "Quarterly";

/**
 * Returns start (inclusive) and end (inclusive) Date objects for the given period.
 * NOTE: Uses server timezone. If you want Asia/Kolkata boundaries, pass a `now` date in that TZ.
 */
export function getPeriodRange(period: Period, now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(now);

  switch (period) {
    case "Daily":
      start.setHours(0, 0, 0, 0);
      break;
    case "Weekly": {
      // treat week as Mon-Sun
      const day = start.getDay(); // 0 (Sun) - 6
      const diffToMon = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diffToMon);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "Monthly":
      start = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0, 0);
      break;
    case "Quarterly": {
      const q = Math.floor(start.getMonth() / 3);
      start = new Date(start.getFullYear(), q * 3, 1, 0, 0, 0, 0);
      break;
    }
  }

  return { start, end };
}

/**
 * Previous period range (immediately before the returned period).
 */
export function getPreviousPeriodRange(period: Period, now = new Date()) {
  const { start } = getPeriodRange(period, now);
  // prevEnd is the millisecond before current start
  const prevEnd = new Date(start);
  prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);

  let prevStart = new Date(start);
  switch (period) {
    case "Daily":
      prevStart.setDate(start.getDate() - 1);
      prevStart.setHours(0, 0, 0, 0);
      break;
    case "Weekly":
      prevStart.setDate(start.getDate() - 7);
      prevStart.setHours(0, 0, 0, 0);
      break;
    case "Monthly":
      prevStart = new Date(
        start.getFullYear(),
        start.getMonth() - 1,
        1,
        0,
        0,
        0,
        0,
      );
      break;
    case "Quarterly":
      prevStart = new Date(
        start.getFullYear(),
        start.getMonth() - 3,
        1,
        0,
        0,
        0,
        0,
      );
      break;
  }

  return { start: prevStart, end: prevEnd };
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return 0;
    // when previous is 0 and current > 0, return null to indicate "N/A" or caller can treat as 100%
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** small formatter for frontend's table */
export function formatMMDDYYYY(d?: Date | string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const yyyy = String(dt.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}
