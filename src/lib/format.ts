export function money(n: number | string | null | undefined, opts: { sign?: boolean; short?: boolean } = {}) {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  if (opts.short && Math.abs(v) >= 10000) {
    return `${v < 0 ? "−$" : "$"}${(Math.abs(v) / 1000).toFixed(1)}k`;
  }
  const s = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(Math.abs(v));
  if (opts.sign) return `${v < 0 ? "−" : "+"}${s}`;
  return v < 0 ? `−${s}` : s;
}

export function pct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function dateShort(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function dateFull(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

export function daysUntil(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  const ms = dt.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function daysInMonthLeft() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function greetingFor(name = "Abhi") {
  const h = new Date().getHours();
  const g = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${g}, ${name}`;
}

export function groupByDate<T extends { occurred_on: string }>(rows: T[]): { key: string; label: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  rows.forEach((r) => {
    const k = r.occurred_on;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  });
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, items]) => ({
      key,
      label: key === today ? "Today" : key === yest ? "Yesterday" : dateFull(key),
      items,
    }));
}