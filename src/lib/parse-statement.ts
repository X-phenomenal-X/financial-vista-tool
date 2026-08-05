// Statement parsing: CSV, plain text, and text-based PDF.
// Everything produced here is a *candidate* — nothing is saved without review.

export type DocKind = "bank" | "credit_card" | "pay_stub" | "retirement";

export interface ParsedItem {
  item_type: "transaction" | "balance" | "minimum_payment" | "due_date" | "apr" | "credit_limit" | "deposit" | "withdrawal";
  occurred_on: string | null;
  description: string;
  amount: number;
  tx_type: "expense" | "income" | "transfer" | "debt_payment";
  category: string | null;
  confidence: number;
  raw: string;
}

export interface ParsedStatement {
  docKind: DocKind;
  statementStart: string | null;
  statementEnd: string | null;
  detected: Record<string, { value: number | string; confidence: number; raw: string }>;
  items: ParsedItem[];
  textLength: number;
  warning?: string;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function iso(y: number, m: number, d: number) {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

export function parseDate(input: string, fallbackYear = new Date().getFullYear()): string | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return iso(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const yr = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    // Canadian statements are usually MM/DD/YYYY; fall back to DD/MM when month > 12.
    const a = +m[1], b = +m[2];
    return a > 12 ? iso(yr, b - 1, a) : iso(yr, a - 1, b);
  }
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo === undefined) return null;
    return iso(m[3] ? +m[3] : fallbackYear, mo, +m[2]);
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:,?\s*(\d{4}))?$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo === undefined) return null;
    return iso(m[3] ? +m[3] : fallbackYear, mo, +m[1]);
  }
  return null;
}

function num(v: string): number | null {
  const cleaned = v.replace(/[$\s,]/g, "").replace(/[()]/g, (c) => (c === "(" ? "-" : ""));
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const neg = /\(/.test(v);
  const n = parseFloat(cleaned);
  return neg ? -Math.abs(n) : n;
}

/* ---------------------------------- CSV ---------------------------------- */

export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === delim && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^"|"$/g, ""));
}

function detectDelim(sample: string) {
  const counts = [",", ";", "\t", "|"].map((d) => [d, (sample.match(new RegExp(`\\${d}`, "g")) || []).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

function guessCategory(desc: string): string | null {
  const d = desc.toLowerCase();
  const map: [RegExp, string][] = [
    [/tim hortons|starbucks|coffee|restaurant|mcdonald|uber eats|doordash|skip ?the ?dishes|pizza|cafe/, "Dining & coffee"],
    [/loblaw|no ?frills|superstore|food ?basics|sobeys|metro|walmart|costco|grocer/, "Groceries"],
    [/petro|esso|shell|husky|ultramar|gas ?bar|circle k|fuel/, "Gas"],
    [/insurance|intact|aviva|belair|desjardins ins/, "Car insurance"],
    [/rogers|bell|telus|fido|koodo|freedom|phone|mobile/, "Phone"],
    [/hydro|enbridge|water|utility|utilities/, "Utilities"],
    [/netflix|spotify|prime|disney|apple\.com\/bill|subscription|patreon|crunchyroll/, "Subscriptions"],
    [/rent|landlord/, "Rent"],
    [/payment ?- ?thank you|payment received|pmt received|bill payment/, "Debt payments"],
    [/payroll|direct deposit|deposit|salary|pay ?cheque|paycheque/, "Income"],
    [/steam|playstation|xbox|nintendo|best buy|amazon/, "Shopping & gaming"],
    [/oil change|canadian tire|mr. lube|repair|tire/, "Car maintenance"],
  ];
  for (const [re, cat] of map) if (re.test(d)) return cat;
  return null;
}

function classify(amount: number, desc: string, docKind: DocKind): ParsedItem["tx_type"] {
  const d = desc.toLowerCase();
  if (/transfer|e-?transfer|interac|roommate/.test(d)) return "transfer";
  if (docKind === "credit_card") {
    if (/payment|thank you/.test(d)) return "debt_payment";
    return "expense";
  }
  if (/payment ?- ?thank you|credit card payment|visa payment|mastercard payment/.test(d)) return "debt_payment";
  return amount > 0 ? "income" : "expense";
}

export function parseCsv(text: string, docKind: DocKind): ParsedStatement {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const delim = detectDelim(lines.slice(0, 5).join("\n"));
  const rows = lines.map((l) => splitCsvLine(l, delim));

  // Find the header row (first row with a date-ish and an amount-ish column name).
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const low = rows[i].map((c) => c.toLowerCase());
    if (low.some((c) => /date/.test(c)) && low.some((c) => /amount|debit|credit|withdraw|deposit|value/.test(c))) { headerIdx = i; break; }
  }

  const header = headerIdx >= 0 ? rows[headerIdx].map((c) => c.toLowerCase()) : [];
  const find = (re: RegExp) => header.findIndex((c) => re.test(c));
  let dateCol = find(/date/);
  let descCol = find(/desc|detail|merchant|payee|narrat|memo|transaction/);
  let amtCol = find(/^amount|amount$|value/);
  const debitCol = find(/debit|withdraw|paid out/);
  const creditCol = find(/credit|deposit|paid in/);

  const body = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;
  const items: ParsedItem[] = [];

  for (const r of body) {
    if (!r.length || r.every((c) => !c)) continue;
    let dateRaw = dateCol >= 0 ? r[dateCol] : "";
    let desc = descCol >= 0 ? r[descCol] : "";
    let amount: number | null = null;
    let confidence = headerIdx >= 0 ? 0.9 : 0.55;

    if (headerIdx < 0) {
      // Headerless: first date-parsable cell, last numeric cell, longest text cell.
      const dIdx = r.findIndex((c) => parseDate(c) !== null);
      if (dIdx < 0) continue;
      dateRaw = r[dIdx];
      const nums = r.map((c, i) => [i, num(c)] as const).filter(([, n]) => n !== null);
      if (!nums.length) continue;
      amount = nums[nums.length - 1][1]!;
      desc = r.filter((c, i) => i !== dIdx && num(c) === null).sort((a, b) => b.length - a.length)[0] ?? "";
    } else {
      if (amtCol >= 0) amount = num(r[amtCol]);
      if (amount === null && (debitCol >= 0 || creditCol >= 0)) {
        const dbt = debitCol >= 0 ? num(r[debitCol]) : null;
        const crd = creditCol >= 0 ? num(r[creditCol]) : null;
        if (dbt) amount = -Math.abs(dbt);
        else if (crd) amount = Math.abs(crd);
      }
    }

    const occurred = parseDate(dateRaw);
    if (amount === null || amount === 0) continue;
    if (!occurred) confidence = Math.min(confidence, 0.4);
    if (!desc) confidence = Math.min(confidence, 0.5);

    // Credit-card statements list purchases as positive charges.
    if (docKind === "credit_card" && amount > 0 && !/payment|thank you|refund|credit/i.test(desc)) amount = -amount;

    const txType = classify(amount, desc, docKind);
    items.push({
      item_type: "transaction",
      occurred_on: occurred,
      description: desc || "Imported item",
      amount: Math.abs(amount),
      tx_type: txType,
      category: guessCategory(desc),
      confidence,
      raw: r.join(" | "),
    });
  }

  const dates = items.map((i) => i.occurred_on).filter(Boolean).sort() as string[];
  return {
    docKind,
    statementStart: dates[0] ?? null,
    statementEnd: dates[dates.length - 1] ?? null,
    detected: summarize(items),
    items,
    textLength: text.length,
  };
}

function summarize(items: ParsedItem[]): ParsedStatement["detected"] {
  const deposits = items.filter((i) => i.tx_type === "income").reduce((s, i) => s + i.amount, 0);
  const withdrawals = items.filter((i) => i.tx_type === "expense").reduce((s, i) => s + i.amount, 0);
  const out: ParsedStatement["detected"] = {};
  if (deposits) out.deposits = { value: deposits, confidence: 0.8, raw: "sum of detected credits" };
  if (withdrawals) out.withdrawals = { value: withdrawals, confidence: 0.8, raw: "sum of detected debits" };
  return out;
}

/* ------------------------------ Plain text/PDF ---------------------------- */

const FIELD_PATTERNS: { key: string; re: RegExp; kind: "money" | "percent" | "date" }[] = [
  { key: "new_balance", re: /(?:new balance|closing balance|statement balance|balance owing|total balance)[^\d\-$]{0,20}\(?\$?\s*(-?[\d,]+\.\d{2})/i, kind: "money" },
  { key: "previous_balance", re: /previous balance[^\d\-$]{0,20}\(?\$?\s*(-?[\d,]+\.\d{2})/i, kind: "money" },
  { key: "account_balance", re: /(?:current balance|available balance|ending balance|account balance)[^\d\-$]{0,20}\(?\$?\s*(-?[\d,]+\.\d{2})/i, kind: "money" },
  { key: "minimum_payment", re: /(?:minimum payment|minimum amount due|min\.? payment)[^\d$]{0,20}\$?\s*([\d,]+\.\d{2})/i, kind: "money" },
  { key: "credit_limit", re: /(?:credit limit|total credit limit)[^\d$]{0,20}\$?\s*([\d,]+(?:\.\d{2})?)/i, kind: "money" },
  { key: "available_credit", re: /available credit[^\d$]{0,20}\$?\s*([\d,]+(?:\.\d{2})?)/i, kind: "money" },
  { key: "net_pay", re: /(?:net pay|net deposit|total net pay)[^\d$]{0,20}\$?\s*([\d,]+\.\d{2})/i, kind: "money" },
  { key: "gross_pay", re: /(?:gross pay|gross earnings|total earnings)[^\d$]{0,20}\$?\s*([\d,]+\.\d{2})/i, kind: "money" },
  { key: "employer_contribution", re: /(?:employer (?:match|contribution)|dpsp)[^\d$]{0,25}\$?\s*([\d,]+\.\d{2})/i, kind: "money" },
  { key: "plan_value", re: /(?:total plan value|market value|plan balance|total value)[^\d$]{0,20}\$?\s*([\d,]+\.\d{2})/i, kind: "money" },
  { key: "purchase_apr", re: /(?:purchase(?:s)? (?:annual interest rate|apr|rate))[^\d]{0,20}([\d]+\.\d{1,2})\s*%/i, kind: "percent" },
  { key: "cash_advance_apr", re: /cash advance[^\d]{0,25}([\d]+\.\d{1,2})\s*%/i, kind: "percent" },
  { key: "annual_interest_rate", re: /annual interest rate[^\d]{0,20}([\d]+\.\d{1,2})\s*%/i, kind: "percent" },
  { key: "due_date", re: /(?:payment due date|due date|payment due)[^\dA-Za-z]{0,10}([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i, kind: "date" },
  { key: "statement_date", re: /(?:statement date|closing date|as of)[^\dA-Za-z]{0,10}([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i, kind: "date" },
  { key: "pay_date", re: /(?:pay date|pay period ending|period ending)[^\dA-Za-z]{0,10}([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i, kind: "date" },
];

const TX_LINE = /^\s*([A-Za-z]{3,9}\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.{3,80}?)\s+\(?\$?(-?[\d,]+\.\d{2})\)?\s*(CR|DR)?\s*$/i;

export function parseText(text: string, docKind: DocKind): ParsedStatement {
  const detected: ParsedStatement["detected"] = {};
  for (const f of FIELD_PATTERNS) {
    const m = text.match(f.re);
    if (!m) continue;
    if (f.kind === "date") {
      const d = parseDate(m[1].replace(/\.$/, ""));
      if (d) detected[f.key] = { value: d, confidence: 0.85, raw: m[0].trim() };
    } else {
      const v = num(m[1]);
      if (v !== null) detected[f.key] = { value: v, confidence: f.kind === "percent" ? 0.85 : 0.8, raw: m[0].trim() };
    }
  }

  const year = (() => {
    const sd = detected.statement_date?.value ?? detected.due_date?.value;
    if (typeof sd === "string") return +sd.slice(0, 4);
    const m = text.match(/\b(20\d{2})\b/);
    return m ? +m[1] : new Date().getFullYear();
  })();

  const items: ParsedItem[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(TX_LINE);
    if (!m) continue;
    const occurred = parseDate(m[1].replace(/\.$/, ""), year);
    const raw = num(m[3]);
    if (raw === null || raw === 0) continue;
    const desc = m[2].replace(/\s{2,}/g, " ").trim();
    if (/balance|total|subtotal|interest rate|credit limit|minimum/i.test(desc)) continue;
    const isCredit = (m[4] || "").toUpperCase() === "CR";
    let signed = raw;
    if (docKind === "credit_card") signed = isCredit || /payment|thank you/i.test(desc) ? Math.abs(raw) : -Math.abs(raw);
    const txType = classify(signed, desc, docKind);
    items.push({
      item_type: "transaction",
      occurred_on: occurred,
      description: desc,
      amount: Math.abs(signed),
      tx_type: txType,
      category: guessCategory(desc),
      confidence: occurred ? 0.65 : 0.35,
      raw: line.trim(),
    });
  }

  const dates = items.map((i) => i.occurred_on).filter(Boolean).sort() as string[];
  Object.assign(detected, summarize(items));
  return {
    docKind,
    statementStart: dates[0] ?? null,
    statementEnd: (typeof detected.statement_date?.value === "string" ? (detected.statement_date.value as string) : dates[dates.length - 1]) ?? null,
    detected,
    items,
    textLength: text.length,
    warning: items.length === 0 ? "No transaction lines were recognised — check the detected summary fields below or add entries manually." : undefined,
  };
}

/* --------------------------------- PDF ----------------------------------- */

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Rebuild visual lines by grouping items on similar y positions.
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as { str: string; transform: number[] }[]) {
      if (!("str" in it)) continue;
      const y = Math.round(it.transform[5]);
      const key = Math.round(y / 3) * 3;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push({ x: it.transform[4], s: it.str });
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map((c) => c.s).join(" ").replace(/\s{2,}/g, "  ").trim())
      .filter(Boolean);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

export function guessDocKind(fileName: string, text: string): DocKind {
  const s = (fileName + " " + text.slice(0, 4000)).toLowerCase();
  if (/rrsp|dpsp|pension|retirement|group savings/.test(s)) return "retirement";
  if (/pay ?stub|earnings statement|net pay|gross pay|pay period/.test(s)) return "pay_stub";
  if (/credit limit|minimum payment|mastercard|visa|cash advance/.test(s)) return "credit_card";
  return "bank";
}

export async function parseStatementFile(file: File, forcedKind?: DocKind): Promise<ParsedStatement> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const text = await extractPdfText(file);
    if (text.replace(/\s/g, "").length < 40) {
      return { docKind: forcedKind ?? "bank", statementStart: null, statementEnd: null, detected: {}, items: [], textLength: text.length, warning: "This PDF has no selectable text (it's likely a scan). Export a CSV from your bank instead, or add the values manually." };
    }
    return parseText(text, forcedKind ?? guessDocKind(file.name, text));
  }
  const text = await file.text();
  const kind = forcedKind ?? guessDocKind(file.name, text);
  if (name.endsWith(".csv") || name.endsWith(".tsv")) return parseCsv(text, kind);
  // .txt — try CSV first when it looks delimited, else text.
  const csvish = text.split(/\r?\n/).slice(0, 5).every((l) => (l.match(/[,;\t]/g) || []).length >= 2);
  return csvish ? parseCsv(text, kind) : parseText(text, kind);
}

/* ------------------------------ Duplicates -------------------------------- */

export function normalizeDesc(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export function findDuplicate<T extends { id: string; occurred_on: string; amount: number | string; description: string | null }>(
  item: { occurred_on: string | null; amount: number; description: string },
  existing: T[],
): T | null {
  const target = normalizeDesc(item.description);
  for (const t of existing) {
    if (Math.abs(Number(t.amount) - item.amount) > 0.011) continue;
    if (item.occurred_on) {
      const diff = Math.abs(new Date(t.occurred_on).getTime() - new Date(item.occurred_on).getTime()) / 86400000;
      if (diff > 3) continue;
    }
    const other = normalizeDesc(t.description ?? "");
    if (!target || !other) return t;
    if (other.includes(target.slice(0, 12)) || target.includes(other.slice(0, 12))) return t;
  }
  return null;
}
