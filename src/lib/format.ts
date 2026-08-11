export function money(
  n: number | string | null | undefined,
  opts: { sign?: boolean; short?: boolean; whole?: boolean } = {},
) {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  if (opts.short && Math.abs(v) >= 10000) {
    return `${v < 0 ? "−$" : "$"}${(Math.abs(v) / 1000).toFixed(1)}k`;
  }
  const s = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    // `whole` drops the cents for round figures like payment amounts, where
    // a trailing ".00" is just noise.
    maximumFractionDigits: opts.whole ? 0 : 2,
    minimumFractionDigits: opts.whole ? 0 : 2,
  }).format(Math.abs(v));
  if (opts.sign) return `${v < 0 ? "−" : "+"}${s}`;
  return v < 0 ? `−${s}` : s;
}

export function pct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a value from a Postgres `date` column at local midnight.
 *
 * `new Date("2026-08-04")` is parsed as UTC midnight, which in
 * America/Toronto is 8pm on Aug 3 — so due dates rendered a day early and
 * transactions dated the 1st fell outside their own month. Values that
 * carry a time (timestamptz) are already unambiguous and pass straight
 * through.
 */
export function parseLocalDate(d: string | Date): Date {
  if (typeof d !== "string") return d;
  if (!DATE_ONLY.test(d)) return new Date(d);
  const [year, month, day] = d.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Local YYYY-MM-DD, matching how a `date` column is stored. */
export function toDateKey(d: Date) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function startOfDay(d: string | Date) {
  const dt = parseLocalDate(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function dateShort(d: string | Date) {
  return parseLocalDate(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function dateFull(d: string | Date) {
  return parseLocalDate(d).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Whole calendar days from today. Counting day boundaries rather than
 * elapsed milliseconds keeps "Due tomorrow" correct late in the evening,
 * and rounding absorbs the 23- and 25-hour days around DST.
 */
export function daysUntil(d: string | Date) {
  const ms = startOfDay(d).getTime() - startOfDay(new Date()).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function daysInMonthLeft() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function greetingFor(name = "Abhi") {
  const h = new Date().getHours();
  const g =
    h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${g}, ${name}`;
}

export function groupByDate<T extends { occurred_on: string }>(
  rows: T[],
): { key: string; label: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  rows.forEach((r) => {
    const k = r.occurred_on;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  });
  // Local keys, not toISOString(): after 8pm in Toronto the UTC date has
  // already rolled over, which labelled today's transactions "Yesterday".
  const today = toDateKey(new Date());
  const yest = toDateKey(new Date(Date.now() - 86400000));
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, items]) => ({
      key,
      label: key === today ? "Today" : key === yest ? "Yesterday" : dateFull(key),
      items,
    }));
}
