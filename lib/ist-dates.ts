/** Application timezone — all business calendar dates (FY, journey close, txn dates) use IST. */
export const APP_TIME_ZONE = "Asia/Kolkata";

/** Calendar date YYYY-MM-DD for an instant, in IST. */
export function isoCalendarDateInAppTimeZone(instant: Date | string): string | null {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayIsoDateInAppTimeZone(): string {
  return isoCalendarDateInAppTimeZone(new Date()) ?? "";
}
