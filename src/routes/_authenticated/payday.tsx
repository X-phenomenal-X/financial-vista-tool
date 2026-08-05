import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus, Save, Trash2, Check, Loader2, CalendarDays } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useAllData, usePaydayPlans, usePlanItems } from "@/lib/queries";
import { buildDefaultLines, computeRunning, avalancheTarget, nextPaydayISO, type PlanLine } from "@/lib/payday";
import { totalCash, CASH_BUFFER } from "@/lib/coach";
import { money, dateShort } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/payday")({
  head: () => ({ meta: [{ title: "Payday Planner — Money Map" }, { name: "description", content: "Plan every dollar of your next pay with a running balance, buffer warnings, and avalanche targeting." }] }),
  component: PaydayPage,
});

function PaydayPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ctx = useAllData(user?.id);
  const { data: plans = [] } = usePaydayPlans(user?.id);
  const [saving, setSaving] = useState(false);
  const [openPlan, setOpenPlan] = useState<string | null>(null);

  const defaults = useMemo(() => {
    const bills = ctx.budget
      .filter((b) => ["Rent", "Car payment", "Car insurance", "Phone", "Utilities", "Gas", "Groceries"].includes(b.name) && Number(b.planned) > 0)
      .map((b) => ({ name: b.name, planned: Number(b.planned) }));
    return buildDefaultLines(ctx.debts, bills);
  }, [ctx.debts, ctx.budget]);

  const [inited, setInited] = useState(false);
  const [payDate, setPayDate] = useState("");
  const [expectedPay, setExpectedPay] = useState(2800);
  const [startingCash, setStartingCash] = useState(0);
  const [buffer, setBuffer] = useState(CASH_BUFFER);
  const [allowance, setAllowance] = useState(0);
  const [extra, setExtra] = useState(0);
  const [lines, setLines] = useState<PlanLine[]>([]);

  if (!ctx.loading && !inited) {
    setInited(true);
    setPayDate(nextPaydayISO(ctx.reminders));
    setStartingCash(Number(totalCash(ctx).toFixed(2)));
    setLines(defaults);
  }
  if (ctx.loading) return <div className="pt-20 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>;

  const target = avalancheTarget(ctx.debts);
  const extraLabel = target ? `Extra to ${target.name} (${Number(target.apr).toFixed(2)}% APR)` : "Extra debt payment";
  const calc = computeRunning({ payDate, expectedPay, startingCash, buffer, spendingAllowance: allowance, extraDebtPayment: extra, lines }, extraLabel);

  function update(i: number, patch: Partial<PlanLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function savePlan() {
    if (!user) return;
    setSaving(true);
    try {
      const { data: plan, error } = await supabase.from("payday_plans").insert({
        user_id: user.id, pay_date: payDate, expected_pay: expectedPay, starting_cash: startingCash,
        buffer, spending_allowance: allowance, extra_debt_payment: extra, status: "active",
      }).select().single();
      if (error) throw error;
      const items = [
        ...lines.map((l, i) => ({ user_id: user.id, plan_id: plan.id, label: l.label, kind: l.kind, debt_id: l.debtId ?? null, amount: l.amount, sort_order: i })),
        ...(allowance > 0 ? [{ user_id: user.id, plan_id: plan.id, label: "Spending allowance", kind: "allowance", debt_id: null, amount: allowance, sort_order: 900 }] : []),
        ...(extra > 0 ? [{ user_id: user.id, plan_id: plan.id, label: extraLabel, kind: "avalanche", debt_id: target?.id ?? null, amount: extra, sort_order: 901 }] : []),
      ];
      if (items.length) {
        const { error: e2 } = await supabase.from("payday_plan_items").insert(items);
        if (e2) throw e2;
      }
      await logAudit(user.id, "payday_plan", "created", `Saved payday plan for ${dateShort(payDate)} (${items.length} allocations)`, { total: calc.allocated }, plan.id);
      qc.invalidateQueries({ queryKey: ["payday_plans", user.id] });
      toast.success("Plan saved");
      setOpenPlan(plan.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the plan.");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 pb-8">
      <header>
        <h1 className="font-display text-2xl">Payday planner</h1>
        <p className="text-xs text-muted-foreground">Start from your real numbers, then change anything. Overdue items and card minimums come first.</p>
      </header>

      <section className="rounded-3xl bg-hero p-5 shadow-elevated">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Cash left after this plan</div>
        <div className={`font-display text-4xl tabular-nums ${calc.overspent ? "text-destructive" : calc.breaksBuffer ? "text-warning" : "text-foreground"}`}>{money(calc.ending)}</div>
        <div className="mt-1 text-xs text-muted-foreground">Starts at {money(calc.start)} · {money(calc.allocated)} allocated · buffer {money(buffer)}</div>
        {calc.overspent && <p className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/15 px-3 py-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4" />This plan spends more than you'll have. Cut {money(-calc.ending)}.</p>}
        {!calc.overspent && calc.breaksBuffer && <p className="mt-3 flex items-center gap-2 rounded-xl bg-warning/15 px-3 py-2 text-xs text-warning"><AlertTriangle className="h-4 w-4" />This breaks your {money(buffer)} cash buffer by {money(buffer - calc.ending)}.</p>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Inputs</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Payday</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
          <div><Label className="text-xs">Expected pay</Label><Input type="number" step="0.01" value={expectedPay} onChange={(e) => setExpectedPay(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Current cash</Label><Input type="number" step="0.01" value={startingCash} onChange={(e) => setStartingCash(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Minimum cash buffer</Label><Input type="number" step="0.01" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Spending allowance</Label><Input type="number" step="0.01" value={allowance} onChange={(e) => setAllowance(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Extra debt payment</Label><Input type="number" step="0.01" value={extra} onChange={(e) => setExtra(Number(e.target.value))} /></div>
        </div>
        {target && <p className="mt-2 text-xs text-muted-foreground">Extra goes to <span className="text-accent">{target.name}</span> — highest APR at {Number(target.apr).toFixed(2)}%. Car loan payments stay on their normal schedule.</p>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Bills &amp; minimums before next pay</h2>
          <Button size="sm" variant="secondary" onClick={() => setLines((l) => [...l, { key: `custom-${Date.now()}`, label: "New item", kind: "bill", amount: 0 }])}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
        </div>
        <div className="mt-3 space-y-2">
          {lines.map((l, i) => (
            <div key={l.key} className="flex items-center gap-2">
              <Input className="h-9 flex-1" value={l.label} onChange={(e) => update(i, { label: e.target.value })} />
              <Input className="h-9 w-28 text-right tabular-nums" type="number" step="0.01" value={l.amount} onChange={(e) => update(i, { amount: Number(e.target.value) })} />
              <button aria-label={`Remove ${l.label}`} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {!lines.length && <p className="text-xs text-muted-foreground">No bills yet — add the ones due before your next pay.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Running balance</h2>
        <div className="mt-3 divide-y divide-border">
          <div className="flex justify-between py-2 text-sm"><span className="text-muted-foreground">Cash + pay</span><span className="tabular-nums">{money(calc.start)}</span></div>
          {calc.rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">−{money(r.amount)}</span>
              <span className={`w-24 text-right tabular-nums ${r.running < 0 ? "text-destructive" : r.breaksBuffer ? "text-warning" : ""}`}>{money(r.running)}</span>
            </div>
          ))}
        </div>
      </section>

      <Button className="w-full bg-violet-grad" onClick={savePlan} disabled={saving || !payDate}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save this plan</Button>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Saved plans</h2>
        {!plans.length && <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">No saved plans yet.</p>}
        {plans.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card">
            <button onClick={() => setOpenPlan(openPlan === p.id ? null : p.id)} className="flex w-full items-center gap-3 p-4 text-left">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-accent"><CalendarDays className="h-4 w-4" /></div>
              <div className="flex-1"><div className="text-sm">Payday {dateShort(p.pay_date)}</div><div className="text-xs text-muted-foreground">Pay {money(p.expected_pay)} · cash {money(p.starting_cash)}</div></div>
              <span className="text-xs text-muted-foreground">{openPlan === p.id ? "Hide" : "Open"}</span>
            </button>
            {openPlan === p.id && <PlanDetail planId={p.id} />}
          </div>
        ))}
      </section>
      <p className="text-center text-xs text-muted-foreground">Need the whole payoff picture? <Link to="/simulator" className="text-accent">Open the payoff simulator</Link>.</p>
    </div>
  );
}

function PlanDetail({ planId }: { planId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = usePlanItems(planId);

  async function togglePaid(id: string, paid: boolean, amount: number, actual: number | null) {
    await supabase.from("payday_plan_items").update({ paid: !paid, actual_amount: !paid ? (actual ?? amount) : null }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["payday_plan_items", planId] });
  }
  async function setActual(id: string, v: number) {
    await supabase.from("payday_plan_items").update({ actual_amount: v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["payday_plan_items", planId] });
  }
  async function del() {
    await supabase.from("payday_plans").delete().eq("id", planId);
    await logAudit(user?.id, "payday_plan", "deleted", "Deleted a saved payday plan", {}, planId);
    qc.invalidateQueries({ queryKey: ["payday_plans", user?.id] });
    toast.success("Plan deleted");
  }

  if (isLoading) return <div className="p-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>;
  const planned = items.reduce((s, i) => s + Number(i.amount), 0);
  const actual = items.reduce((s, i) => s + Number(i.actual_amount ?? 0), 0);

  return (
    <div className="border-t border-border p-4">
      <div className="mb-3 flex justify-between text-xs text-muted-foreground"><span>Planned {money(planned)}</span><span>Actual {money(actual)} · {money(actual - planned, { sign: true })} vs plan</span></div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-sm">
            <button aria-label={i.paid ? `Mark ${i.label} unpaid` : `Mark ${i.label} paid`} onClick={() => togglePaid(i.id, i.paid, Number(i.amount), i.actual_amount === null ? null : Number(i.actual_amount))} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${i.paid ? "border-success bg-success/20 text-success" : "border-border text-muted-foreground"}`}><Check className="h-3.5 w-3.5" /></button>
            <span className={`min-w-0 flex-1 truncate ${i.paid ? "line-through opacity-60" : ""}`}>{i.label}</span>
            <span className="w-20 text-right tabular-nums text-muted-foreground">{money(i.amount)}</span>
            <Input className="h-8 w-24 text-right tabular-nums" type="number" step="0.01" placeholder="actual" value={i.actual_amount === null ? "" : String(i.actual_amount)} onChange={(e) => setActual(i.id, Number(e.target.value))} />
          </div>
        ))}
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="mt-3 text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Delete plan</Button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this payday plan?</AlertDialogTitle><AlertDialogDescription>The plan and its allocations are removed. Your transactions and balances are untouched.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={del}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
