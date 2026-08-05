import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, Shield, Loader2, AlertTriangle, CheckCircle2, Trash2, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useStatementImports, useImportItems, useAccounts, useDebts, useTransactions } from "@/lib/queries";
import { parseStatementFile, findDuplicate, type DocKind } from "@/lib/parse-statement";
import { money, dateShort } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { ImportItem } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/uploads")({
  head: () => ({ meta: [{ title: "Statement Uploads — Money Map" }, { name: "description", content: "Upload bank, credit card, pay stub, and retirement statements and review every extracted item before saving." }] }),
  component: UploadsPage,
});

const KINDS: { value: DocKind; label: string }[] = [
  { value: "bank", label: "Bank statement" },
  { value: "credit_card", label: "Credit card" },
  { value: "pay_stub", label: "Pay stub" },
  { value: "retirement", label: "Retirement" },
];

const FIELD_LABELS: Record<string, string> = {
  new_balance: "Statement balance", previous_balance: "Previous balance", account_balance: "Account balance",
  minimum_payment: "Minimum payment", credit_limit: "Credit limit", available_credit: "Available credit",
  net_pay: "Net pay", gross_pay: "Gross pay", employer_contribution: "Employer contribution", plan_value: "Plan value",
  purchase_apr: "Purchase APR", cash_advance_apr: "Cash advance APR", annual_interest_rate: "Interest rate",
  due_date: "Payment due date", statement_date: "Statement date", pay_date: "Pay date",
  deposits: "Total deposits", withdrawals: "Total withdrawals",
};

function UploadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: imports = [], isLoading } = useStatementImports(user?.id);
  const { data: accounts = [] } = useAccounts(user?.id);
  const { data: debts = [] } = useDebts(user?.id);
  const [openId, setOpenId] = useState<string | null>(null);

  if (openId) return <ReviewScreen importId={openId} onBack={() => setOpenId(null)} />;

  return (
    <div className="space-y-5 pb-8">
      <header>
        <h1 className="font-display text-2xl">Statement uploads</h1>
        <p className="text-xs text-muted-foreground">CSV, TXT, and text-based PDF. Nothing is saved until you review it.</p>
      </header>

      <UploadCard accounts={accounts} debts={debts} onDone={(id) => { qc.invalidateQueries({ queryKey: ["statement_imports", user?.id] }); setOpenId(id); }} />

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>Everything extracted lands in a review table first. Money Map never updates a balance or adds a transaction without your confirmation, and flags anything that looks like a duplicate.</span>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Import history</h2>
        {isLoading && <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
        {!isLoading && !imports.length && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No statements imported yet. Upload one above to get started.</p>
          </div>
        )}
        {imports.map((im) => (
          <button key={im.id} onClick={() => setOpenId(im.id)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:bg-secondary/40">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-accent"><FileText className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{im.file_name}</div>
              <div className="text-xs text-muted-foreground">
                {KINDS.find((k) => k.value === im.doc_kind)?.label ?? im.doc_kind} · {im.items_total} item{im.items_total === 1 ? "" : "s"}
                {im.statement_end ? ` · to ${dateShort(im.statement_end)}` : ""}
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${im.status === "applied" ? "bg-success/20 text-success" : im.status === "discarded" ? "bg-secondary text-muted-foreground" : "bg-warning/20 text-warning"}`}>{im.status === "applied" ? `${im.items_accepted} saved` : im.status}</span>
          </button>
        ))}
      </section>
    </div>
  );
}

function UploadCard({ accounts, debts, onDone }: { accounts: { id: string; name: string }[]; debts: { id: string; name: string }[]; onDone: (id: string) => void }) {
  const { user } = useAuth();
  const { data: existingTx = [] } = useTransactions(user?.id);
  const [kind, setKind] = useState<DocKind | "auto">("auto");
  const [accountId, setAccountId] = useState<string>("none");
  const [debtId, setDebtId] = useState<string>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("That file is larger than 15 MB. Please split it or export a CSV.");
      const parsed = await parseStatementFile(file, kind === "auto" ? undefined : kind);
      const { data: imp, error: impErr } = await supabase
        .from("statement_imports")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_type: file.name.split(".").pop()?.toLowerCase() ?? "txt",
          file_size: file.size,
          doc_kind: parsed.docKind,
          account_id: accountId === "none" ? null : accountId,
          debt_id: debtId === "none" ? null : debtId,
          statement_start: parsed.statementStart,
          statement_end: parsed.statementEnd,
          detected: parsed.detected as never,
          status: "pending",
          items_total: parsed.items.length,
        })
        .select()
        .single();
      if (impErr) throw impErr;

      if (parsed.items.length) {
        const rows = parsed.items.map((it) => {
          const dup = findDuplicate({ occurred_on: it.occurred_on, amount: it.amount, description: it.description }, existingTx.map((t) => ({ id: t.id, occurred_on: t.occurred_on, amount: t.amount, description: t.description })));
          return {
            user_id: user.id,
            import_id: imp.id,
            item_type: it.item_type,
            occurred_on: it.occurred_on,
            description: it.description,
            amount: it.amount,
            category: it.category,
            tx_type: it.tx_type,
            confidence: it.confidence,
            duplicate_of: dup?.id ?? null,
            decision: dup ? "exclude" : it.confidence < 0.5 ? "review" : "accept",
            raw: it.raw,
          };
        });
        const { error: itemErr } = await supabase.from("import_items").insert(rows);
        if (itemErr) throw itemErr;
      }
      await logAudit(user.id, "statement_import", "created", `Uploaded ${file.name} (${parsed.items.length} candidate items)`, { doc_kind: parsed.docKind }, imp.id);
      if (parsed.warning) toast.warning(parsed.warning);
      else toast.success(`${parsed.items.length} item${parsed.items.length === 1 ? "" : "s"} ready for review`);
      onDone(imp.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read that file.";
      setError(msg); toast.error(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-3xl border border-dashed border-border bg-card p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Document type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as DocKind | "auto")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="auto">Detect automatically</SelectItem>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Linked account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">None</SelectItem>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Linked card / loan</Label>
          <Select value={debtId} onValueChange={setDebtId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">None</SelectItem>{debts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-grad shadow-card">
          {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary-foreground" /> : <Upload className="h-6 w-6 text-primary-foreground" />}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{busy ? "Reading your statement…" : "CSV, TSV, TXT, or text-based PDF · up to 15 MB"}</p>
        <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,.pdf,text/csv,text/plain,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        <Button className="mt-4 bg-violet-grad" disabled={busy} onClick={() => inputRef.current?.click()}>Choose file</Button>
        {error && <p className="mt-3 flex items-center justify-center gap-2 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{error}</p>}
      </div>
    </section>
  );
}

function ReviewScreen({ importId, onBack }: { importId: string; onBack: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: imports = [] } = useStatementImports(user?.id);
  const { data: items = [], isLoading } = useImportItems(importId);
  const { data: accounts = [] } = useAccounts(user?.id);
  const { data: debts = [] } = useDebts(user?.id);
  const [applying, setApplying] = useState(false);
  const im = imports.find((i) => i.id === importId);

  async function patch(id: string, patchData: Partial<ImportItem>) {
    await supabase.from("import_items").update(patchData as never).eq("id", id);
    qc.invalidateQueries({ queryKey: ["import_items", importId] });
  }
  async function setAllDecision(decision: string) {
    await supabase.from("import_items").update({ decision }).eq("import_id", importId).is("duplicate_of", null);
    qc.invalidateQueries({ queryKey: ["import_items", importId] });
  }

  const accepted = items.filter((i) => i.decision === "accept");

  async function apply() {
    if (!user || !im) return;
    setApplying(true);
    try {
      const rows = accepted.map((i) => ({
        user_id: user.id,
        occurred_on: i.occurred_on ?? new Date().toISOString().slice(0, 10),
        type: i.tx_type,
        category: i.category,
        account_id: im.account_id,
        debt_id: im.debt_id,
        description: i.description,
        amount: Number(i.amount),
        cleared: true,
      }));
      if (rows.length) {
        const { error } = await supabase.from("transactions").insert(rows);
        if (error) throw error;
      }
      await supabase.from("statement_imports").update({ status: "applied", items_accepted: rows.length }).eq("id", importId);
      await logAudit(user.id, "statement_import", "applied", `Saved ${rows.length} transaction${rows.length === 1 ? "" : "s"} from ${im.file_name}`, { import_id: importId }, importId);
      qc.invalidateQueries({ queryKey: ["transactions", user.id] });
      qc.invalidateQueries({ queryKey: ["statement_imports", user.id] });
      toast.success(`Saved ${rows.length} transaction${rows.length === 1 ? "" : "s"}`);
      onBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save these items.");
    } finally {
      setApplying(false);
    }
  }

  async function applyDetected(key: string, value: number) {
    if (!user || !im) return;
    if (key === "minimum_payment" && im.debt_id) {
      await supabase.from("debts").update({ minimum_payment: value, minimum_estimated: false }).eq("id", im.debt_id);
      await logAudit(user.id, "debt", "updated", `Minimum payment set to ${money(value)} from ${im.file_name}`, { field: "minimum_payment", value }, im.debt_id);
      qc.invalidateQueries({ queryKey: ["debts", user.id] });
      return toast.success("Minimum payment updated");
    }
    if ((key === "new_balance" || key === "account_balance") && im.debt_id) {
      const prev = debts.find((d) => d.id === im.debt_id);
      await supabase.from("debts").update({ balance: value }).eq("id", im.debt_id);
      await logAudit(user.id, "debt", "updated", `${prev?.name ?? "Debt"} balance ${money(prev?.balance ?? 0)} → ${money(value)} from ${im.file_name}`, { field: "balance", from: prev?.balance, to: value }, im.debt_id);
      qc.invalidateQueries({ queryKey: ["debts", user.id] });
      return toast.success("Balance updated");
    }
    if ((key === "account_balance" || key === "plan_value") && im.account_id) {
      const prev = accounts.find((a) => a.id === im.account_id);
      await supabase.from("accounts").update({ balance: value }).eq("id", im.account_id);
      await logAudit(user.id, "account", "updated", `${prev?.name ?? "Account"} balance ${money(prev?.balance ?? 0)} → ${money(value)} from ${im.file_name}`, { from: prev?.balance, to: value }, im.account_id);
      qc.invalidateQueries({ queryKey: ["accounts", user.id] });
      return toast.success("Balance updated");
    }
    if (key === "credit_limit" && im.debt_id) {
      await supabase.from("debts").update({ credit_limit: value }).eq("id", im.debt_id);
      qc.invalidateQueries({ queryKey: ["debts", user.id] });
      return toast.success("Credit limit updated");
    }
    toast.error("Link this import to an account or card first, then apply the value.");
  }

  async function discard() {
    if (!user) return;
    await supabase.from("statement_imports").delete().eq("id", importId);
    await logAudit(user.id, "statement_import", "deleted", `Discarded import ${im?.file_name ?? ""}`, {}, importId);
    qc.invalidateQueries({ queryKey: ["statement_imports", user.id] });
    toast.success("Import discarded — nothing was saved");
    onBack();
  }

  return (
    <div className="space-y-5 pb-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" />Back to uploads</button>
      <header>
        <h1 className="font-display text-2xl">Review before saving</h1>
        <p className="text-xs text-muted-foreground">{im?.file_name} · {im?.statement_start ? `${dateShort(im.statement_start)} – ` : ""}{im?.statement_end ? dateShort(im.statement_end) : "period not detected"}</p>
      </header>

      {im && Object.keys(im.detected ?? {}).length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Detected values</h2>
          <p className="mt-1 text-xs text-muted-foreground">Apply each one only if it's correct. Nothing here is applied automatically.</p>
          <div className="mt-3 space-y-2">
            {Object.entries(im.detected).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span>{FIELD_LABELS[k] ?? k}</span>
                    {v.confidence < 0.7 && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] uppercase text-warning">low confidence</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{v.raw}</div>
                </div>
                <div className="tabular-nums">{typeof v.value === "number" ? (k.includes("apr") || k.includes("rate") ? `${v.value}%` : money(v.value)) : dateShort(String(v.value))}</div>
                {typeof v.value === "number" && !k.includes("apr") && !k.includes("rate") && (
                  <Button size="sm" variant="secondary" onClick={() => applyDetected(k, v.value as number)}>Apply</Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Candidate transactions ({items.length})</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAllDecision("accept")}>Accept all</Button>
            <Button size="sm" variant="secondary" onClick={() => setAllDecision("exclude")}>Exclude all</Button>
          </div>
        </div>
        {isLoading && <div className="rounded-2xl border border-border bg-card p-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>}
        {!isLoading && !items.length && <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">No transaction lines were recognised in this file. You can still apply the detected values above, or add entries manually.</div>}
        {items.map((it) => (
          <div key={it.id} className={`rounded-2xl border p-4 ${it.decision === "exclude" ? "border-border bg-card opacity-60" : it.duplicate_of ? "border-warning/50 bg-card" : "border-border bg-card"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Input className="h-9 w-[9.5rem]" type="date" value={it.occurred_on ?? ""} onChange={(e) => patch(it.id, { occurred_on: e.target.value })} />
              <Input className="h-9 min-w-[10rem] flex-1" value={it.description ?? ""} onChange={(e) => patch(it.id, { description: e.target.value })} />
              <Input className="h-9 w-28 text-right tabular-nums" type="number" step="0.01" value={String(it.amount)} onChange={(e) => patch(it.id, { amount: Number(e.target.value) })} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Select value={it.tx_type} onValueChange={(v) => patch(it.id, { tx_type: v })}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="debt_payment">Debt payment</SelectItem><SelectItem value="transfer">Transfer</SelectItem></SelectContent>
              </Select>
              <Input className="h-8 w-40 text-xs" placeholder="Category" value={it.category ?? ""} onChange={(e) => patch(it.id, { category: e.target.value })} />
              <div className="ml-auto flex gap-1">
                {(["accept", "review", "exclude"] as const).map((d) => (
                  <button key={d} onClick={() => patch(it.id, { decision: d })} className={`rounded-full px-3 py-1 text-xs capitalize ${it.decision === d ? (d === "accept" ? "bg-success/20 text-success" : d === "exclude" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning") : "bg-secondary text-muted-foreground"}`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              {Number(it.confidence) < 0.6 && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">Low confidence — check this one</span>}
              {it.duplicate_of && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">Looks like a duplicate of an existing transaction</span>}
              {it.raw && <span className="truncate">{it.raw}</span>}
            </div>
          </div>
        ))}
      </section>

      <div className="sticky bottom-24 z-20 flex gap-2 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur lg:bottom-4">
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="ghost" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Discard</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Discard this import?</AlertDialogTitle><AlertDialogDescription>The uploaded statement record and all {items.length} candidate items are removed. No saved transactions or balances change.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={discard}>Discard</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="flex-1 bg-violet-grad" disabled={applying || !accepted.length}>
              {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Save {accepted.length} accepted
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Save {accepted.length} transactions?</AlertDialogTitle><AlertDialogDescription>Only items marked “accept” are added. Excluded and review items stay unsaved, and no balances change unless you applied a detected value.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={apply}>Save them</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
