/** Local-time YYYY-MM-DD (not UTC, so late-night logs land on the right day in IST). */
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function dayLabel(key: string) {
  const today = dayKey();
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  return parseDay(key).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}
