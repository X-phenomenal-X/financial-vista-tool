import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { greetingFor, money, dateShort, daysUntil } from "@/lib/format";
import { totalCash, highInterestDebt, carLoanBalance, totalRetirement, netWorth, availableAboveBuffer, urgentActions, todayAction, priorityOrder, utilization, CASH_BUFFER, paydayPlan } from "@/lib/coach";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle, TrendingUp } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Home — Money Map" }, { name: "description", content: "Your daily money picture: cash, high-interest debt, and the next action." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const [showPlan, setShowPlan] = useState(false);
  if (ctx.loading) return <div className="pt-20 text-center text-muted-foreground">Loading…</div>;

  const cash = totalCash(ctx);
  const hi = highInterestDebt(ctx);
  const above = availableAboveBuffer(ctx);
  const urgent = urgentActions(ctx);
  const prio = priorityOrder(ctx).filter((d) => d.kind !== "car_loan").slice(0, 2);
  const upcomingReminders = ctx.reminders.filter((r) => !r.completed).slice(0, 3);

  return (
    <div className="space-y-6 pb-8">
      <header>
        <p className="text-sm text-muted-foreground">{greetingFor("Abhi")}</p>
        <h1 className="font-display text-3xl leading-tight">Here's your money today.</h1>
      </header>

      <section className="rounded-3xl bg-hero p-6 shadow-elevated">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Available above buffer</div>
        <div className="font-display text-5xl tabular-nums text-foreground">{money(above)}</div>
        <div className="mt-1 text-xs text-muted-foreground">Cash {money(cash)} · buffer {money(CASH_BUFFER)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-card/60 p-3"><div className="text-xs text-muted-foreground">High-interest debt</div><div className="mt-1 font-display text-xl text-destructive">{money(hi)}</div></div>
          <div className="rounded-xl bg-card/60 p-3"><div className="text-xs text-muted-foreground">Retirement</div><div className="mt-1 font-display text-xl text-accent">{money(totalRetirement(ctx))}</div></div>
        </div>
        <Button className="mt-5 w-full bg-violet-grad" onClick={() => setShowPlan((s) => !s)}>Plan my next pay <ArrowRight className="ml-2 h-4 w-4" /></Button>
        {showPlan && (
          <div className="mt-4 rounded-xl bg-card/70 p-4 text-sm">
            {paydayPlan(ctx).map((l, i) => <div key={i} className="py-0.5">{l}</div>)}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent"><TrendingUp className="h-3.5 w-3.5" />Coach</div>
        <h2 className="mt-2 text-base font-medium">What should I do today?</h2>
        <p className="mt-2 text-sm text-muted-foreground">{todayAction(ctx)}</p>
        <Link to="/assistant" className="mt-3 inline-flex items-center gap-1 text-sm text-accent">Ask more <ArrowRight className="h-3.5 w-3.5" /></Link>
      </section>

      {urgent.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold">Urgent</h2>
          <ul className="mt-3 space-y-2">
            {urgent.map((u, i) => (
              <li key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${u.tone === "danger" ? "bg-destructive/15 text-destructive" : u.tone === "warning" ? "bg-warning/15 text-warning" : "bg-secondary/60"}`}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {u.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Priority debts</h2><Link to="/debts" className="text-xs text-accent">All debts</Link></div>
        <div className="space-y-3">
          {prio.map((d) => {
            const u = utilization(d);
            return (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-baseline justify-between"><div className="font-medium">{d.name}</div><div className="font-display text-xl tabular-nums">{money(Number(d.balance) + Number(d.pending || 0))}</div></div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>APR {Number(d.apr).toFixed(2)}%</span>
                  {d.credit_limit && <span className={u >= 1 ? "text-destructive" : u >= 0.8 ? "text-warning" : ""}>Util {(u * 100).toFixed(0)}%</span>}
                  {d.due_date && <span>Due {dateShort(d.due_date)} ({daysUntil(d.due_date)}d)</span>}
                  <span>Min {money(d.minimum_payment)}{d.minimum_estimated ? "*" : ""}</span>
                  {d.status === "past_due" && <span className="text-destructive font-medium">PAST DUE</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {upcomingReminders.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Upcoming</h2><Link to="/automations" className="text-xs text-accent">All</Link></div>
          <div className="space-y-2">
            {upcomingReminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <div>{r.title}<div className="text-xs text-muted-foreground">{new Date(r.due_at).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</div></div>
                <div className="text-xs text-muted-foreground">{r.recurrence}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Net worth</div>
        <div className="mt-1 font-display text-2xl tabular-nums">{money(netWorth(ctx))}</div>
        <div className="mt-1 text-xs text-muted-foreground">Cash + retirement − all debts (incl. car loan {money(carLoanBalance(ctx))}).</div>
      </section>
    </div>
  );
}