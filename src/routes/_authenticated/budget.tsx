import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useBudget, useTransactions } from "@/lib/queries";
import { money, daysInMonthLeft } from "@/lib/format";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({ meta: [{ title: "Budget — Money Map" }, { name: "description", content: "Planned vs actual with clear remaining amounts." }] }),
  component: BudgetPage,
});

function BudgetPage() {
  const { user } = useAuth();
  const { data: cats = [] } = useBudget(user?.id);
  const { data: tx = [] } = useTransactions(user?.id);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const daysLeft = daysInMonthLeft();
  const rows = cats.map((c) => {
    const actual = tx.filter((t) => t.category === c.name && new Date(t.occurred_on) >= monthStart && t.type !== "transfer").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const planned = Number(c.planned);
    return { ...c, planned, actual, remaining: planned - actual, pct: planned > 0 ? Math.min(100, (actual / planned) * 100) : 0 };
  });
  const expenses = rows.filter((r) => r.kind === "expense" || r.kind === "debt");
  const savings = rows.filter((r) => r.kind === "savings");
  const transfers = rows.filter((r) => r.kind === "transfer");
  const income = rows.filter((r) => r.kind === "income");
  const spent = expenses.reduce((s, r) => s + r.actual, 0);
  const plannedTotal = expenses.reduce((s, r) => s + r.planned, 0);

  return (
    <div className="space-y-5 pb-8">
      <header><h1 className="font-display text-2xl">Budget</h1><p className="text-xs text-muted-foreground">{daysLeft} day{daysLeft === 1 ? "" : "s"} left this month · transfers excluded from spend</p></header>

      <section className="rounded-3xl bg-hero p-6 shadow-elevated text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Spent this month</div>
        <div className="mt-1 font-display text-4xl tabular-nums">{money(spent)}</div>
        <div className="mt-1 text-xs text-muted-foreground">of {money(plannedTotal)} planned</div>
        <Progress value={plannedTotal > 0 ? (spent / plannedTotal) * 100 : 0} className="mt-4" />
      </section>

      <Section title="Expenses" rows={expenses} />
      <Section title="Savings" rows={savings} />
      <Section title="Income" rows={income} />
      <Section title="Transfers (not spend)" rows={transfers} muted />
    </div>
  );
}

function Section({ title, rows, muted }: { title: string; rows: any[]; muted?: boolean }) {
  if (!rows.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="space-y-2">
        {rows.map((r) => {
          const over = r.planned > 0 && r.actual > r.planned;
          return (
            <div key={r.id} className={`rounded-2xl border border-border bg-card p-4 ${muted ? "opacity-70" : ""}`}>
              <div className="flex items-baseline justify-between"><div className="text-sm font-medium">{r.name}</div><div className="font-display tabular-nums">{money(r.actual)} <span className="text-xs text-muted-foreground">/ {money(r.planned)}</span></div></div>
              {r.planned > 0 && <Progress value={r.pct} className={`mt-2 ${over ? "[&>*]:bg-destructive" : ""}`} />}
              <div className="mt-1 text-xs text-muted-foreground">{r.planned === 0 ? (r.actual > 0 ? `${money(r.actual)} spent — no budget set.` : "No budget set.") : over ? `Over by ${money(-r.remaining)}.` : `${money(r.remaining)} left${r.name.toLowerCase().includes("dining") ? " for dining" : ""}.`}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}