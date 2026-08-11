import { supabase } from "@/integrations/supabase/client";

export function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export const BACKUP_TABLES = ["accounts", "debts", "budget_categories", "transactions", "goals", "reminders", "payday_plans", "payday_plan_items", "statement_imports", "import_items"] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export async function fetchAll(table: BackupTable) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

export async function buildBackup() {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const t of BACKUP_TABLES) out[t] = await fetchAll(t);
  return { app: "money-map", version: 2, exported_at: new Date().toISOString(), tables: out };
}

export interface RestoreReport { table: string; inserted: number; skipped: number; error?: string }

/** Restores rows the account doesn't already have. Existing ids are skipped (duplicate protection). */
export async function restoreBackup(json: unknown, userId: string): Promise<RestoreReport[]> {
  const parsed = json as { tables?: Record<string, Record<string, unknown>[]> };
  if (!parsed || typeof parsed !== "object" || !parsed.tables) throw new Error("This file isn't a Wealthpilot backup.");
  const reports: RestoreReport[] = [];
  for (const t of BACKUP_TABLES) {
    const rows = parsed.tables[t];
    if (!Array.isArray(rows) || !rows.length) continue;
    const existing = new Set((await fetchAll(t)).map((r) => String(r.id)));
    const fresh = rows.filter((r) => r.id && !existing.has(String(r.id))).map((r) => ({ ...r, user_id: userId }));
    if (!fresh.length) { reports.push({ table: t, inserted: 0, skipped: rows.length }); continue; }
    const { error } = await supabase.from(t).insert(fresh as never);
    reports.push({ table: t, inserted: error ? 0 : fresh.length, skipped: rows.length - fresh.length, error: error?.message });
  }
  return reports;
}
