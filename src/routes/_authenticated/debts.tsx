import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useDebts } from "@/lib/queries";
import { money, dateShort, daysUntil } from "@/lib/format";
import { utilization, priorityOrder } from "@/lib/coach";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({ meta: [{ title: "Debts — Money Map" }, { name: "description", content: "Balances, APRs, utilization, minimums, and payoff priority." }] }),
  component: DebtsPage,
});

function DebtsPage() {
  const { user } = useAuth();
  const { data: debts = [] } = useDebts(user?.id);
  const ctx = { debts, accounts: [], budget: [], transactions: [], reminders: [], goals: [] };
  const ordered = priorityOrder(ctx as any);

  return (
    <div className="space-y-4 pb-8">
      <header><h1 className="font-display text-2xl">Debts</h1><p className="text-xs text-muted-foreground">Avalanche order · past-due first</p></header>
      {ordered.map((d, i) => {
        const u = utilization(d);
        const over100 = u >= 1;
        const over80 = u >= 0.8 && !over100;
        return (
          <div key={d.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-xs text-muted-foreground">Priority {i + 1}</div><div className="mt-0.5 font-medium">{d.name}</div></div>
              <div className="text-right"><div className="font-display text-2xl tabular-nums">{money(Number(d.balance) + Number(d.pending || 0))}</div>{Number(d.pending) !== 0 && <div className="text-[10px] text-muted-foreground">incl. pending {money(Number(d.pending), { sign: true })}</div>}</div>
            </div>
            {d.status === "past_due" && <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Past due — pay minimum today</div>}
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <Cell k="APR" v={`${Number(d.apr).toFixed(2)}%`} />
              {d.credit_limit && <Cell k="Limit" v={money(d.credit_limit)} />}
              <Cell k="Minimum" v={`${money(d.minimum_payment)}${d.minimum_estimated ? " *est" : ""}`} />
              {d.due_date && <Cell k="Due" v={`${dateShort(d.due_date)} (${daysUntil(d.due_date)}d)`} />}
            </div>
            {d.credit_limit && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">Utilization</span><span className={over100 ? "text-destructive font-medium" : over80 ? "text-warning font-medium" : "text-muted-foreground"}>{(u * 100).toFixed(0)}%</span></div>
                <Progress value={Math.min(100, u * 100)} className={over100 ? "[&>*]:bg-destructive" : over80 ? "[&>*]:bg-warning" : ""} />
              </div>
            )}
            {d.notes && <p className="mt-3 text-xs text-muted-foreground">{d.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) { return <div><div className="text-muted-foreground">{k}</div><div className="mt-0.5 tabular-nums">{v}</div></div>; }