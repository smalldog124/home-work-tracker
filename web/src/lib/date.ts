export function thaiDate(value: string | null): string {
  if (!value) return "—";
  const parts = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  }).formatToParts(new Date(value));
  return ["day", "month", "year"]
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join("/");
}
