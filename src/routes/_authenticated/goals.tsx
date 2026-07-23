import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useGoals } from "@/lib/queries";
import { money } from "@/lib/format";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Goals — Money Map" }, { name: "description", content: "Emergency fund, credit-card payoff, retirement, and FHSA." }] }),
  component: GoalsPage,
});

function GoalsPage() {
  const { user } = useAuth();
  const { data: goals = [] } = useGoals(user?.id);
  return (
    <div className="space-y-4 pb-8">
      <h1 className="font-display text-2xl">Goals</h1>
      {goals.map((g, i) => {
        const t = Number(g.target_amount), c = Number(g.current_amount);
        const pct = t > 0 ? Math.min(100, (c / t) * 100) : 0;
        const hero = i === 0;
        return (
          <div key={g.id} className={`rounded-2xl border border-border p-5 shadow-card ${hero ? "bg-hero" : "bg-card"} ${!g.active ? "opacity-60" : ""}`}>
            <div className="flex items-baseline justify-between"><div className="font-medium">{g.name}</div>{!g.active && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Not active yet</span>}</div>
            <div className="mt-1 font-display text-2xl tabular-nums">{money(c)} <span className="text-sm text-muted-foreground">/ {money(t)}</span></div>
            <Progress value={pct} className="mt-3" />
            {g.notes && <p className="mt-2 text-xs text-muted-foreground">{g.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}