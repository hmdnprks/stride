// Runs once per server instance, before any request.
//
// Stride works out "today", week and month boundaries, and display times on
// the server. Serverless hosts run in UTC (and reserve the TZ variable), so a
// runner in UTC+7 would see the wrong day until 7am. STRIDE_TIMEZONE (an IANA
// name like "Asia/Jakarta") sets the zone every server-side Date uses.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const zone = process.env.STRIDE_TIMEZONE;
  if (!zone) return;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    process.env.TZ = zone;
  } catch {
    console.warn(`STRIDE_TIMEZONE "${zone}" isn't a valid IANA time zone; using the server's own.`);
  }
}
