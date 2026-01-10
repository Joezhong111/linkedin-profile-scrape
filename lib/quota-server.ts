export function getCurrentMonthPeriod(): { start: string; end: string } {
  const now = new Date();
  // Start of the month in UTC
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // End of the month in UTC
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
