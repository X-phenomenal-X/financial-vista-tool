import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTransactions, useBudget } from "@/lib/queries";
import { groupByDate, money } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Search, ArrowLeftRight, ArrowDown, ArrowUp, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity — Money Map" }, { name: "description", content: "All money in and out, grouped by day." }] }),
  component: Activity,
});

function typeIcon(t: string) {
  if (t === "transfer") return <ArrowLeftRight className="h-4 w-4" />;
  if (t === "income") return <ArrowDown className="h-4 w-4" />;
  if (t === "debt_payment") return <CreditCard className="h-4 w-4" />;
  return <ArrowUp className="h-4 w-4" />;
}

function Activity() {
  const { user } = useAuth();
  const { data: tx = [], isLoading } = useTransactions(user?.id);
  useBudget(user?.id);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const filtered = useMemo(() => tx.filter((t) => {
    if (filter !== "all" && t.type !== filter) return false;
    if (q && !`${t.description ?? ""} ${t.category ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [tx, q, filter]);
  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div className="space-y-4 pb-8">
      <h1 className="font-display text-2xl">Activity</h1>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-9" /></div>
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
        {[["all","All"],["expense","Expenses"],["income","Income"],["debt_payment","Payments"],["transfer","Transfers"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`shrink-0 rounded-full px-3 py-1.5 ${filter === v ? "bg-violet-grad text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && grouped.length === 0 && <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No transactions yet. Tap the + button to add one.</div>}
      {grouped.map((g) => (
        <section key={g.key}>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{g.label}</div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {g.items.map((t) => {
              const amt = Number(t.amount);
              const isTransfer = t.type === "transfer";
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${isTransfer ? "bg-secondary text-muted-foreground" : amt >= 0 ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"}`}>{typeIcon(t.type)}</div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm">{t.description || t.category || t.type}</div><div className="text-xs text-muted-foreground">{t.category ?? t.type}{isTransfer ? " · transfer" : ""}{!t.cleared ? " · pending" : ""}</div></div>
                  <div className={`font-display tabular-nums ${isTransfer ? "text-muted-foreground" : amt >= 0 ? "text-success" : "text-foreground"}`}>{money(amt, { sign: !isTransfer })}</div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}