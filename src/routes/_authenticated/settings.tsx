import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock3,
  Download,
  FileJson,
  FileSpreadsheet,
  RotateCcw,
  Shield,
  Smartphone,
  Sparkles,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePwa } from "@/hooks/use-pwa";
import { useAllData, useAuditLog, useProfile } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { buildBackup, download, restoreBackup, toCsv } from "@/lib/backup";
import { logAudit } from "@/lib/audit";
import { signOutCompletely } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Wealthpilot" },
      { name: "description", content: "Profile, secure backups, exports, restore, audit history, and privacy." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pwa = usePwa();
  const { data: profile } = useProfile(user?.id);
  const ctx = useAllData(user?.id);
  const { data: audit = [], isLoading: auditLoading } = useAuditLog(user?.id);
  const restoreInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"backup" | "restore" | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<string | null>(null);
  const [auditEntity, setAuditEntity] = useState("all");

  const stamp = () => new Date().toISOString().slice(0, 10);

  async function exportFullBackup() {
    setBusy("backup");
    try {
      const backup = await buildBackup();
      download(`money-map-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), "application/json");
      await logAudit(user?.id, "backup", "exported", "Exported full Wealthpilot JSON backup", {
        version: backup.version,
        tables: Object.keys(backup.tables),
      });
      qc.invalidateQueries({ queryKey: ["audit_log", user?.id] });
      toast.success("Full backup downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build the backup");
    } finally {
      setBusy(null);
    }
  }

  function exportCsv(name: string, rows: unknown[]) {
    const records = rows as Record<string, unknown>[];
    download(`money-map-${name}-${stamp()}.csv`, toCsv(records), "text/csv;charset=utf-8");
    toast.success(`${name.replace(/-/g, " ")} exported`);
  }

  async function restoreFile(file: File) {
    if (!user) return;
    setBusy("restore");
    setRestoreSummary(null);
    try {
      const parsed = JSON.parse(await file.text()) as { app?: string; version?: number; tables?: unknown };
      if (parsed.app !== "money-map" || !parsed.tables || typeof parsed.version !== "number") {
        throw new Error("This is not a valid Wealthpilot backup file.");
      }
      if (!window.confirm("Restore missing records from this backup? Existing record IDs will be skipped and nothing will be overwritten.")) {
        return;
      }

      const report = await restoreBackup(parsed, user.id);
      const inserted = report.reduce((sum, item) => sum + item.inserted, 0);
      const skipped = report.reduce((sum, item) => sum + item.skipped, 0);
      const errors = report.filter((item) => item.error);
      setRestoreSummary(`${inserted} inserted · ${skipped} duplicates skipped${errors.length ? ` · ${errors.length} table errors` : ""}`);
      await logAudit(user.id, "backup", "restored", `Restored ${inserted} records from backup`, {
        inserted,
        skipped,
        errors: errors.map((item) => ({ table: item.table, error: item.error })),
      });
      await qc.invalidateQueries();
      if (errors.length) toast.warning("Restore finished with some table errors. Review the summary and history.");
      else toast.success("Backup restored safely");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore that file");
    } finally {
      setBusy(null);
      if (restoreInput.current) restoreInput.current.value = "";
    }
  }

  const entities = [...new Set(audit.map((item) => item.entity))].sort();
  const filteredAudit = audit.filter((item) => auditEntity === "all" || item.entity === auditEntity).slice(0, 40);

  return (
    <div className="space-y-5 pb-8">
      <h1 className="font-display text-2xl">Settings</h1>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">Email</span><span className="truncate">{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span>{profile?.is_owner ? "Yes" : "No"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span>CAD</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Timezone</span><span>America/Toronto</span></div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Install & offline access</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Install Wealthpilot to your home screen for full-screen use. Recently viewed screens stay readable without a connection; edits need you back online.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs ${pwa.online ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
            {pwa.online ? "Online" : "Offline — read-only"}
          </span>
          <span className="rounded-full bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
            {pwa.installed ? "Installed" : "Not installed"}
          </span>
          {!pwa.installed && pwa.canInstall && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const accepted = await pwa.install();
                if (accepted) toast.success("Wealthpilot is installing");
              }}
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Install app
            </Button>
          )}
        </div>
        {pwa.installMethod === "ios-safari" && (
          <div className="mt-3 rounded-xl bg-secondary/40 px-3 py-3 text-xs text-muted-foreground">
            On iPhone: open Wealthpilot in Safari, tap the Share button, then choose “Add to Home
            Screen”. iOS doesn’t offer a one-tap install button to websites.
          </div>
        )}
        {pwa.installMethod === "manual" && (
          <div className="mt-3 rounded-xl bg-secondary/40 px-3 py-3 text-xs text-muted-foreground">
            Use your browser’s menu and look for “Install app” or “Add to Home screen”. If it isn’t
            there, this browser doesn’t support installing web apps.
          </div>
        )}
        {pwa.updateAvailable && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-3 text-xs">
            <span className="text-foreground">A new version of Wealthpilot is ready.</span>
            <Button size="sm" variant="secondary" onClick={pwa.applyUpdate}>
              Reload now
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Full backup & restore</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The JSON backup includes accounts, debts, budgets, transactions, goals, reminders, payday plans, and statement-import review data.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={exportFullBackup} disabled={busy !== null}>
            <Download className="mr-2 h-4 w-4" />
            {busy === "backup" ? "Building backup…" : "Download full backup"}
          </Button>
          <Button variant="secondary" onClick={() => restoreInput.current?.click()} disabled={busy !== null}>
            <Upload className="mr-2 h-4 w-4" />
            {busy === "restore" ? "Restoring…" : "Restore backup"}
          </Button>
          <input
            ref={restoreInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void restoreFile(file);
            }}
          />
        </div>
        <div className="mt-3 rounded-xl bg-secondary/40 px-3 py-3 text-xs text-muted-foreground">
          Restore never overwrites an existing record ID. New records require confirmation and duplicate IDs are skipped.
        </div>
        {restoreSummary && <div className="mt-2 rounded-xl bg-success/10 px-3 py-2 text-xs text-success">{restoreSummary}</div>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">CSV exports</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Export individual sections for spreadsheets or your own records.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ExportButton label="Transactions" onClick={() => exportCsv("transactions", ctx.transactions)} />
          <ExportButton label="Debts" onClick={() => exportCsv("debts", ctx.debts)} />
          <ExportButton label="Budget" onClick={() => exportCsv("budget", ctx.budget)} />
          <ExportButton label="Goals" onClick={() => exportCsv("goals", ctx.goals)} />
          <ExportButton label="Reminders" onClick={() => exportCsv("reminders", ctx.reminders)} />
          <ExportButton label="Accounts" onClick={() => exportCsv("accounts", ctx.accounts)} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-accent" />
            <div>
              <h2 className="text-sm font-semibold">Change history</h2>
              <p className="text-xs text-muted-foreground">Important imports, balance edits, plans, reminders, and backups.</p>
            </div>
          </div>
          <Select value={auditEntity} onValueChange={setAuditEntity}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activity</SelectItem>
              {entities.map((entity) => <SelectItem key={entity} value={entity}>{entity.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 space-y-2">
          {auditLoading && <div className="text-xs text-muted-foreground">Loading history…</div>}
          {filteredAudit.map((item) => (
            <div key={item.id} className="rounded-xl bg-secondary/35 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm">{item.summary}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {item.entity.replace(/_/g, " ")} · {item.action}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[10px] text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                  <br />
                  {new Date(item.created_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          {!auditLoading && !filteredAudit.length && (
            <div className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">No matching history yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-accent" /><h2 className="text-sm font-semibold">Data privacy</h2></div>
        <p className="mt-2 text-xs text-muted-foreground">
          Wealthpilot is private and single-owner. Row-level security scopes financial records to the signed-in account. Uploaded documents require review and confirmation before any balance or transaction is saved.
        </p>
      </section>

      <section className="rounded-2xl bg-hero p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">Built-in coach</h2>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">Active</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The coach reads live app values and works without a paid AI API. A future optional AI provider can be connected without replacing these calculations.
        </p>
      </section>

      <Button
        variant="ghost"
        className="w-full text-destructive"
        onClick={async () => {
          await signOutCompletely();
          location.href = "/auth";
        }}
      >
        Sign out
      </Button>
    </div>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} className="justify-start">
      <Download className="mr-2 h-3.5 w-3.5" /> {label}
    </Button>
  );
}
