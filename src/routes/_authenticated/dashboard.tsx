import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { greetingFor, money, dateShort, daysUntil } from "@/lib/format";
import { totalCash, highInterestDebt, carLoanBalance, totalRetirement, netWorth, availableAboveBuffer, urgentActions, todayAction, priorityOrder, utilization, CASH_BUFFER, paydayPlan } from "@/lib/coach";
import { financialHealth } from "@/lib/financial-health";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle, TrendingUp, WalletCards, CalendarClock, RefreshCw, Target, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Command Center — Wealthpilot" }, { name: "description", content: "Your live financial command center with cash, debt, goals, bills, and next actions." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const [showPlan, setShowPlan] = useState(false);
  if (ctx.loading) return <div className="pt-20 text-center text-muted-foreground">Loading your command center…</div>;

  const cash = totalCash(ctx);
  const hi = highInterestDebt(ctx);
  const retirement = totalRetirement(ctx);
  const currentNetWorth = netWorth(ctx);
  const above = availableAboveBuffer(ctx);
  const urgent = urgentActions(ctx);
  const health = financialHealth(ctx);
  const prio = priorityOrder(ctx).filter((d) => d.kind !== "car_loan").slice(0, 2);
  const upcomingReminders = ctx.reminders.filter((r) => !r.completed).slice(0, 3);
  const topGoal = [...ctx.goals].sort((a, b) => Number(b.current_amount || 0) / Math.max(1, Number(b.target_amount || 1)) - Number(a.current_amount || 0) / Math.max(1, Number(a.target_amount || 1)))[0];
  const topGoalProgress = topGoal ? Math.min(100, Math.round(Number(topGoal.current_amount || 0) / Math.max(1, Number(topGoal.target_amount || 1)) * 100)) : 0;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{greetingFor("Abhay")}</p>
          <h1 className="font-display text-3xl leading-tight">Financial Command Center</h1>
        </div>
        <div className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">Live</div>
      </header>

      <section className="relative overflow-hidden rounded-3xl bg-hero p-6 shadow-elevated">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Safe to use above buffer</div>
          <div className="mt-2 font-display text-5xl tabular-nums text-foreground">{money(above)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Cash {money(cash)} · protected buffer {money(CASH_BUFFER)}</div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl bg-card/60 p-3"><div className="text-[11px] text-muted-foreground">Net worth</div><div className="mt-1 font-display text-lg">{money(currentNetWorth)}</div></div>
            <div className="rounded-xl bg-card/60 p-3"><div className="text-[11px] text-muted-foreground">Card debt</div><div className="mt-1 font-display text-lg text-destructive">{money(hi)}</div></div>
            <div className="rounded-xl bg-card/60 p-3"><div className="text-[11px] text-muted-foreground">Retirement</div><div className="mt-1 font-display text-lg text-accent">{money(retirement)}</div></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button className="bg-violet-grad" asChild><Link to="/payday">Plan next pay <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button variant="secondary" onClick={() => setShowPlan((s) => !s)}>{showPlan ? "Hide plan" : "Quick plan"}</Button>
          </div>
          {showPlan && <div className="mt-4 rounded-xl bg-card/70 p-4 text-sm">{paydayPlan(ctx).map((l, i) => <div key={i} className="py-0.5">{l}</div>)}</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent"><ShieldCheck className="h-4 w-4" />Financial health</div>
            <div className="mt-2 flex items-end gap-2"><span className="font-display text-4xl">{health.score}</span><span className="pb-1 text-sm text-muted-foreground">/ 100 · {health.label}</span></div>
          </div>
          <div className="relative grid h-20 w-20 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--accent)) ${health.score * 3.6}deg, hsl(var(--secondary)) 0deg)` }}>
            <div className="grid h-16 w-16 place-items-center rounded-full bg-card text-lg font-semibold">{health.score}</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${health.score}%` }} /></div>
        <div className="mt-4 rounded-xl bg-secondary/40 p-3 text-sm"><strong>Best next move:</strong> <span className="text-muted-foreground">{health.nextBestAction}</span></div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link to="/bill-calendar" className="rounded-2xl border border-border bg-card p-4 shadow-card transition-transform active:scale-[0.98]"><CalendarClock className="h-5 w-5 text-accent" /><div className="mt-3 font-medium">Bill calendar</div><div className="mt-1 text-xs text-muted-foreground">Forecast upcoming payments</div></Link>
        <Link to="/subscriptions" className="rounded-2xl border border-border bg-card p-4 shadow-card transition-transform active:scale-[0.98]"><RefreshCw className="h-5 w-5 text-warning" /><div className="mt-3 font-medium">Subscriptions</div><div className="mt-1 text-xs text-muted-foreground">Control recurring costs</div></Link>
        <Link to="/net-worth" className="rounded-2xl border border-border bg-card p-4 shadow-card transition-transform active:scale-[0.98]"><WalletCards className="h-5 w-5 text-emerald-300" /><div className="mt-3 font-medium">Net worth</div><div className="mt-1 text-xs text-muted-foreground">Track your long-term trend</div></Link>
        <Link to="/goals" className="rounded-2xl border border-border bg-card p-4 shadow-card transition-transform active:scale-[0.98]"><Target className="h-5 w-5 text-accent" /><div className="mt-3 font-medium">Goals</div><div className="mt-1 text-xs text-muted-foreground">Build your next milestone</div></Link>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent"><Sparkles className="h-4 w-4" />Today’s recommendation</div>
        <h2 className="mt-2 text-base font-medium">What should I do today?</h2>
        <p className="mt-2 text-sm text-muted-foreground">{todayAction(ctx)}</p>
        <Link to="/assistant" className="mt-3 inline-flex items-center gap-1 text-sm text-accent">Ask Wealthpilot <ArrowRight className="h-3.5 w-3.5" /></Link>
      </section>

      {urgent.length > 0 && <section className="rounded-2xl border border-border bg-card p-5 shadow-card"><h2 className="text-sm font-semibold">Needs attention</h2><ul className="mt-3 space-y-2">{urgent.map((u, i) => <li key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${u.tone === "danger" ? "bg-destructive/15 text-destructive" : u.tone === "warning" ? "bg-warning/15 text-warning" : "bg-secondary/60"}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{u.text}</li>)}</ul></section>}

      {topGoal && <section className="rounded-2xl border border-border bg-card p-5 shadow-card"><div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Closest goal</div><div className="mt-1 font-medium">{topGoal.name}</div></div><div className="font-display text-2xl">{topGoalProgress}%</div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent" style={{ width: `${topGoalProgress}%` }} /></div><div className="mt-2 text-xs text-muted-foreground">{money(topGoal.current_amount)} of {money(topGoal.target_amount)}</div></section>}

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Priority debts</h2><Link to="/debts" className="text-xs text-accent">All debts</Link></div>
        <div className="space-y-3">{prio.map((d) => { const u = utilization(d); return <div key={d.id} className="rounded-2xl border border-border bg-card p-4 shadow-card"><div className="flex items-baseline justify-between"><div className="font-medium">{d.name}</div><div className="font-display text-xl tabular-nums">{money(Number(d.balance) + Number(d.pending || 0))}</div></div><div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground"><span>APR {Number(d.apr).toFixed(2)}%</span>{d.credit_limit && <span className={u >= 1 ? "text-destructive" : u >= 0.8 ? "text-warning" : ""}>Util {(u * 100).toFixed(0)}%</span>}{d.due_date && <span>Due {dateShort(d.due_date)} ({daysUntil(d.due_date)}d)</span>}<span>Min {money(d.minimum_payment)}{d.minimum_estimated ? "*" : ""}</span>{d.status === "past_due" && <span className="font-medium text-destructive">PAST DUE</span>}</div></div>; })}</div>
      </section>

      {upcomingReminders.length > 0 && <section><div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Upcoming</h2><Link to="/automations" className="text-xs text-accent">All</Link></div><div className="space-y-2">{upcomingReminders.map((r) => <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"><div>{r.title}<div className="text-xs text-muted-foreground">{new Date(r.due_at).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</div></div><div className="text-xs text-muted-foreground">{r.recurrence}</div></div>)}</div></section>}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card"><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><TrendingUp className="h-4 w-4" />Long-term position</div><div className="mt-2 font-display text-2xl tabular-nums">{money(currentNetWorth)}</div><div className="mt-1 text-xs text-muted-foreground">Cash + retirement − all debts, including car loan {money(carLoanBalance(ctx))}.</div></section>
    </div>
  );
}
