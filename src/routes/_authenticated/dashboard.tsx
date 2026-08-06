import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { greetingFor, money, dateShort, daysUntil } from "@/lib/format";
import { totalCash, highInterestDebt, carLoanBalance, totalRetirement, netWorth, availableAboveBuffer, urgentActions, todayAction, priorityOrder, utilization, CASH_BUFFER, paydayPlan } from "@/lib/coach";
import { financialHealth } from "@/lib/financial-health";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle, TrendingUp, WalletCards, CalendarClock, RefreshCw, Target, ShieldCheck, Sparkles, Eye, EyeOff, Zap, ChevronRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Command Center — Wealthpilot" }, { name: "description", content: "Your live financial command center with cash, debt, goals, bills, and next actions." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const [showPlan, setShowPlan] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);
  if (ctx.loading) return <div className="space-y-4 pt-10"><div className="h-28 animate-pulse rounded-3xl bg-secondary/60"/><div className="h-56 animate-pulse rounded-3xl bg-secondary/40"/><div className="grid grid-cols-2 gap-3"><div className="h-28 animate-pulse rounded-2xl bg-secondary/40"/><div className="h-28 animate-pulse rounded-2xl bg-secondary/40"/></div></div>;

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
  const displayMoney = (value: number) => hideBalances ? "••••••" : money(value);

  const quickActions = [
    { to: "/bill-calendar", label: "Bills", caption: "Upcoming payments", icon: CalendarClock, tone: "text-accent" },
    { to: "/subscriptions", label: "Subscriptions", caption: "Recurring costs", icon: RefreshCw, tone: "text-warning" },
    { to: "/net-worth", label: "Net worth", caption: "Long-term position", icon: WalletCards, tone: "text-emerald-300" },
    { to: "/goals", label: "Goals", caption: "Track milestones", icon: Target, tone: "text-accent" },
  ] as const;

  return (
    <div className="space-y-6 pb-10">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div>
          <p className="text-sm text-muted-foreground">{greetingFor("Abhay")}</p>
          <h1 className="font-display text-3xl leading-tight">Command Center</h1>
          <p className="mt-1 text-xs text-muted-foreground">Your money, priorities, and next move in one place.</p>
        </div>
        <button onClick={() => setHideBalances((v) => !v)} className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card/80 shadow-card backdrop-blur transition hover:-translate-y-0.5 active:scale-95" aria-label={hideBalances ? "Show balances" : "Hide balances"}>{hideBalances ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-hero p-6 shadow-elevated">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-accent/20 blur-3xl transition-transform duration-700 group-hover:scale-125" />
        <div className="absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"><Zap className="h-3.5 w-3.5 text-accent"/>Available above buffer</div>
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">Live</span>
          </div>
          <div className="mt-4 font-display text-5xl tabular-nums tracking-tight text-foreground sm:text-6xl">{displayMoney(above)}</div>
          <div className="mt-2 text-xs text-muted-foreground">Cash {displayMoney(cash)} · protected buffer {displayMoney(CASH_BUFFER)}</div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              ["Net worth", currentNetWorth, "text-foreground"],
              ["Card debt", hi, "text-destructive"],
              ["Retirement", retirement, "text-accent"],
            ].map(([label, value, tone]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-card/55 p-3 backdrop-blur transition hover:-translate-y-1 hover:bg-card/70"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className={`mt-1 truncate font-display text-lg ${tone}`}>{displayMoney(Number(value))}</div></div>)}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button className="h-12 rounded-2xl bg-violet-grad shadow-lg transition hover:-translate-y-0.5 active:scale-[0.98]" asChild><Link to="/payday">Plan next pay <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button variant="secondary" className="h-12 rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition hover:bg-white/10 active:scale-[0.98]" onClick={() => setShowPlan((s) => !s)}>{showPlan ? "Hide quick plan" : "Quick plan"}</Button>
          </div>
          {showPlan && <div className="mt-4 animate-in fade-in slide-in-from-top-2 rounded-2xl border border-white/10 bg-card/75 p-4 text-sm backdrop-blur"><div className="mb-2 text-xs uppercase tracking-wider text-accent">Recommended split</div>{paydayPlan(ctx).map((l, i) => <div key={i} className="border-b border-border/50 py-2 last:border-0">{l}</div>)}</div>}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-elevated">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent"><ShieldCheck className="h-4 w-4" />Financial health</div>
            <div className="mt-2 flex items-end gap-2"><span className="font-display text-4xl">{health.score}</span><span className="pb-1 text-sm text-muted-foreground">/ 100 · {health.label}</span></div>
          </div>
          <div className="relative grid h-20 w-20 place-items-center rounded-full shadow-inner" style={{ background: `conic-gradient(hsl(var(--accent)) ${health.score * 3.6}deg, hsl(var(--secondary)) 0deg)` }}><div className="grid h-16 w-16 place-items-center rounded-full bg-card text-lg font-semibold">{health.score}</div></div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${health.score}%` }} /></div>
        <div className="mt-4 rounded-2xl bg-secondary/40 p-3 text-sm"><strong>Best next move:</strong> <span className="text-muted-foreground">{health.nextBestAction}</span></div>
        <Link to="/financial-health" className="mt-4 inline-flex items-center gap-1 text-sm text-accent">View score breakdown <ChevronRight className="h-4 w-4"/></Link>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Quick actions</h2><p className="text-xs text-muted-foreground">Jump into the tools you use most.</p></div></div>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({to, label, caption, icon: Icon, tone}) => <Link key={to} to={to} className="group rounded-3xl border border-border bg-card p-4 shadow-card transition duration-200 hover:-translate-y-1 hover:border-accent/30 hover:shadow-elevated active:scale-[0.98]"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-secondary/70"><Icon className={`h-5 w-5 ${tone}`} /></div><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1"/></div><div className="mt-4 font-medium">{label}</div><div className="mt-1 text-xs text-muted-foreground">{caption}</div></Link>)}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 via-card to-card p-5 shadow-card">
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-accent/10 blur-2xl"/>
        <div className="relative"><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent"><Sparkles className="h-4 w-4" />Today’s recommendation</div><h2 className="mt-2 text-lg font-medium">Your smartest next move</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{todayAction(ctx)}</p><Link to="/assistant" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent transition hover:bg-accent/15 active:scale-[0.98]">Ask Wealthpilot <ArrowRight className="h-3.5 w-3.5" /></Link></div>
      </section>

      {urgent.length > 0 && <section className="rounded-3xl border border-border bg-card p-5 shadow-card"><h2 className="text-sm font-semibold">Needs attention</h2><ul className="mt-3 space-y-2">{urgent.map((u, i) => <li key={i} className={`flex items-start gap-2 rounded-2xl px-3 py-3 text-sm ${u.tone === "danger" ? "bg-destructive/15 text-destructive" : u.tone === "warning" ? "bg-warning/15 text-warning" : "bg-secondary/60"}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{u.text}</li>)}</ul></section>}

      {topGoal && <section className="rounded-3xl border border-border bg-card p-5 shadow-card"><div className="flex items-center justify-between"><div><div className="text-xs uppercase tracking-wider text-muted-foreground">Closest goal</div><div className="mt-1 font-medium">{topGoal.name}</div></div><div className="font-display text-2xl">{topGoalProgress}%</div></div><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${topGoalProgress}%` }} /></div><div className="mt-2 text-xs text-muted-foreground">{displayMoney(Number(topGoal.current_amount))} of {displayMoney(Number(topGoal.target_amount))}</div></section>}

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Priority debts</h2><Link to="/debts" className="text-xs text-accent">View all</Link></div>
        <div className="space-y-3">{prio.map((d) => { const u = utilization(d); return <Link to="/debts" key={d.id} className="block rounded-3xl border border-border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-elevated active:scale-[0.99]"><div className="flex items-baseline justify-between gap-3"><div className="font-medium">{d.name}</div><div className="font-display text-xl tabular-nums">{displayMoney(Number(d.balance) + Number(d.pending || 0))}</div></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>APR {Number(d.apr).toFixed(2)}%</span>{d.credit_limit && <span className={u >= 1 ? "text-destructive" : u >= 0.8 ? "text-warning" : ""}>Util {(u * 100).toFixed(0)}%</span>}{d.due_date && <span>Due {dateShort(d.due_date)} ({daysUntil(d.due_date)}d)</span>}<span>Min {displayMoney(Number(d.minimum_payment))}{d.minimum_estimated ? "*" : ""}</span>{d.status === "past_due" && <span className="font-medium text-destructive">PAST DUE</span>}</div>{d.credit_limit && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${u >= 1 ? "bg-destructive" : u >= 0.8 ? "bg-warning" : "bg-accent"}`} style={{width: `${Math.min(100, u * 100)}%`}}/></div>}</Link>; })}</div>
      </section>

      {upcomingReminders.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Upcoming</h2><Link to="/automations" className="text-xs text-accent">View all</Link></div><div className="space-y-2">{upcomingReminders.map((r) => <div key={r.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-card"><div>{r.title}<div className="text-xs text-muted-foreground">{new Date(r.due_at).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</div></div><div className="rounded-full bg-secondary px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{r.recurrence}</div></div>)}</div></section>}

      <section className="rounded-3xl border border-border bg-card p-5 shadow-card"><div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><TrendingUp className="h-4 w-4" />Long-term position</div><div className="mt-2 font-display text-2xl tabular-nums">{displayMoney(currentNetWorth)}</div><div className="mt-1 text-xs text-muted-foreground">Cash + retirement − all debts, including car loan {displayMoney(carLoanBalance(ctx))}.</div></section>
    </div>
  );
}
