import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  Gauge,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDebts } from "@/lib/queries";
import { money, dateShort, daysUntil } from "@/lib/format";
import { utilization, priorityOrder } from "@/lib/coach";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({
    meta: [
      { title: "Debt Control — Wealthpilot" },
      {
        name: "description",
        content: "A premium debt command center for balances, APRs, utilization, due dates, and payoff priority.",
      },
    ],
  }),
  component: DebtsPage,
});

type Filter = "all" | "urgent" | "cards" | "loans";

function DebtsPage() {
  const { user } = useAuth();
  const { data: debts = [], isLoading } = useDebts(user?.id);
  const [balancesVisible, setBalancesVisible] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ctx = { debts, accounts: [], budget: [], transactions: [], reminders: [], goals: [] };
  const ordered = useMemo(() => priorityOrder(ctx as any), [debts]);

  const metrics = useMemo(() => {
    const totalDebt = ordered.reduce((sum, debt) => sum + Number(debt.balance) + Number(debt.pending || 0), 0);
    const totalMinimums = ordered.reduce((sum, debt) => sum + Number(debt.minimum_payment || 0), 0);
    const monthlyInterest = ordered.reduce((sum, debt) => {
      const balance = Number(debt.balance) + Number(debt.pending || 0);
      return sum + balance * (Number(debt.apr || 0) / 100) / 12;
    }, 0);
    const weightedApr = totalDebt > 0
      ? ordered.reduce((sum, debt) => {
          const balance = Number(debt.balance) + Number(debt.pending || 0);
          return sum + balance * Number(debt.apr || 0);
        }, 0) / totalDebt
      : 0;
    const cardBalance = ordered
      .filter((debt) => Number(debt.credit_limit || 0) > 0)
      .reduce((sum, debt) => sum + Number(debt.balance) + Number(debt.pending || 0), 0);
    const cardLimits = ordered.reduce((sum, debt) => sum + Number(debt.credit_limit || 0), 0);
    const aggregateUtilization = cardLimits > 0 ? cardBalance / cardLimits : 0;
    const pastDue = ordered.filter((debt) => debt.status === "past_due").length;
    const dueSoon = ordered.filter((debt) => {
      if (!debt.due_date) return false;
      const days = daysUntil(debt.due_date);
      return days >= 0 && days <= 7;
    }).length;
    return { totalDebt, totalMinimums, monthlyInterest, weightedApr, aggregateUtilization, pastDue, dueSoon };
  }, [ordered]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return ordered.filter((debt) => {
      const util = utilization(debt);
      const days = debt.due_date ? daysUntil(debt.due_date) : null;
      const urgent = debt.status === "past_due" || util >= 0.8 || (days !== null && days >= 0 && days <= 7);
      const isCard = Number(debt.credit_limit || 0) > 0;
      const matchesFilter =
        filter === "all" ||
        (filter === "urgent" && urgent) ||
        (filter === "cards" && isCard) ||
        (filter === "loans" && !isCard);
      const matchesSearch = !search || `${debt.name} ${debt.notes || ""}`.toLowerCase().includes(search);
      return matchesFilter && matchesSearch;
    });
  }, [filter, ordered, query]);

  const focusDebt = ordered[0];
  const status = metrics.pastDue > 0
    ? { label: "Action needed", tone: "text-destructive", panel: "bg-destructive/10 border-destructive/20" }
    : metrics.aggregateUtilization >= 0.8
      ? { label: "High utilization", tone: "text-warning", panel: "bg-warning/10 border-warning/20" }
      : { label: "On track", tone: "text-success", panel: "bg-success/10 border-success/20" };

  const showMoney = (value: number) => balancesVisible ? money(value) : "••••";

  if (isLoading) {
    return (
      <div className="space-y-5 pb-8">
        <div className="h-16 animate-pulse rounded-2xl bg-secondary/50" />
        <div className="h-72 animate-pulse rounded-3xl bg-secondary/50" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 animate-pulse rounded-2xl bg-secondary/50" />
          <div className="h-24 animate-pulse rounded-2xl bg-secondary/50" />
        </div>
        <div className="h-44 animate-pulse rounded-3xl bg-secondary/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Payoff priority and credit pressure</p>
          <h1 className="font-display text-3xl">Debt control</h1>
        </div>
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setBalancesVisible((visible) => !visible)}
          aria-label={balancesVisible ? "Hide balances" : "Show balances"}
          className="rounded-2xl"
        >
          {balancesVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>
      </header>

      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-hero p-6 shadow-elevated">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <WalletCards className="h-4 w-4 text-accent" /> Total debt
              </div>
              <div className="mt-2 font-display text-5xl tabular-nums">{showMoney(metrics.totalDebt)}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Weighted APR {metrics.weightedApr.toFixed(2)}% · about {showMoney(metrics.monthlyInterest)} interest this month
              </div>
            </div>
            <div className={`rounded-2xl border px-3 py-2 text-right ${status.panel}`}>
              <div className={`text-xs font-medium ${status.tone}`}>{status.label}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">Live debt status</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <MetricTile label="Minimums" value={showMoney(metrics.totalMinimums)} />
            <MetricTile label="Card use" value={`${Math.round(metrics.aggregateUtilization * 100)}%`} />
            <MetricTile label="Due soon" value={String(metrics.dueSoon + metrics.pastDue)} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button asChild className="bg-violet-grad">
              <Link to="/simulator">Build payoff plan <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/payday">Fund next payment</Link>
            </Button>
          </div>
        </div>
      </section>

      {focusDebt && (
        <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-card via-card to-accent/10 p-5 shadow-card">
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.2em] text-accent">Best next move</div>
              <div className="mt-1 font-semibold">Focus on {focusDebt.name}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {focusDebt.status === "past_due"
                  ? `Bring the ${showMoney(Number(focusDebt.minimum_payment || 0))} minimum current before sending extra money elsewhere.`
                  : `Keep every minimum current, then direct extra debt money here at ${Number(focusDebt.apr || 0).toFixed(2)}% APR.`}
              </p>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search debts"
            className="h-12 rounded-2xl pl-10"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["all", "urgent", "cards", "loans"] as Filter[]).map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium capitalize transition active:scale-95 ${
                filter === item
                  ? "bg-foreground text-background shadow-md"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {filtered.map((debt) => {
          const priority = ordered.findIndex((item) => item.id === debt.id) + 1;
          const util = utilization(debt);
          const isCard = Number(debt.credit_limit || 0) > 0;
          const over100 = util >= 1;
          const over80 = util >= 0.8 && !over100;
          const days = debt.due_date ? daysUntil(debt.due_date) : null;
          const overdue = debt.status === "past_due" || (days !== null && days < 0);
          const dueSoon = days !== null && days >= 0 && days <= 7;
          const balance = Number(debt.balance) + Number(debt.pending || 0);
          const estimatedInterest = balance * (Number(debt.apr || 0) / 100) / 12;
          const expanded = expandedId === debt.id;
          const tone = overdue
            ? "border-destructive/35 bg-destructive/[0.04]"
            : over80 || dueSoon
              ? "border-warning/30 bg-warning/[0.03]"
              : "border-border bg-card";

          return (
            <article key={debt.id} className={`overflow-hidden rounded-3xl border shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${tone}`}>
              <button
                type="button"
                className="w-full p-5 text-left active:bg-secondary/20"
                onClick={() => setExpandedId(expanded ? null : debt.id)}
                aria-expanded={expanded}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${isCard ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground"}`}>
                      {isCard ? <CreditCard className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-semibold">{debt.name}</div>
                        <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] text-muted-foreground">Priority {priority}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span>{Number(debt.apr || 0).toFixed(2)}% APR</span>
                        {debt.due_date && <span>Due {dateShort(debt.due_date)}</span>}
                        {overdue && <span className="font-medium text-destructive">Past due</span>}
                        {!overdue && dueSoon && <span className="font-medium text-warning">Due soon</span>}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-xl tabular-nums">{showMoney(balance)}</div>
                    <ChevronDown className={`ml-auto mt-1 h-4 w-4 text-muted-foreground transition ${expanded ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {isCard && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Credit utilization</span>
                      <span className={over100 ? "font-semibold text-destructive" : over80 ? "font-semibold text-warning" : "text-success"}>
                        {(util * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${over100 ? "bg-destructive" : over80 ? "bg-warning" : "bg-accent"}`}
                        style={{ width: `${Math.min(100, util * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>

              {expanded && (
                <div className="border-t border-border/70 px-5 pb-5 pt-4">
                  {(overdue || over80) && (
                    <div className={`mb-4 flex items-start gap-2 rounded-2xl px-3 py-3 text-xs ${overdue ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{overdue ? "Pay at least the minimum immediately to bring this account current." : "Utilization is above 80%. Reducing this balance should improve your overall credit pressure."}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <DetailCell icon={Gauge} label="Estimated interest" value={`${showMoney(estimatedInterest)} / month`} />
                    <DetailCell icon={CalendarClock} label="Minimum payment" value={`${showMoney(Number(debt.minimum_payment || 0))}${debt.minimum_estimated ? " est." : ""}`} />
                    {debt.credit_limit && <DetailCell icon={CreditCard} label="Credit limit" value={showMoney(Number(debt.credit_limit))} />}
                    <DetailCell icon={ShieldAlert} label="Status" value={overdue ? "Past due" : dueSoon ? "Due soon" : "Current"} />
                  </div>

                  {Number(debt.pending || 0) !== 0 && (
                    <div className="mt-3 rounded-2xl bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
                      Balance includes pending activity of {showMoney(Number(debt.pending || 0))}.
                    </div>
                  )}
                  {debt.notes && <p className="mt-3 text-xs leading-5 text-muted-foreground">{debt.notes}</p>}

                  <Button asChild size="sm" className="mt-4 w-full bg-violet-grad">
                    <Link to="/simulator">Test extra payments <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              )}
            </article>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <Search className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No matching debts</p>
            <p className="mt-1 text-xs text-muted-foreground">Try another search or filter.</p>
          </div>
        )}
      </section>

      {ordered.length === 0 && (
        <section className="rounded-3xl border border-dashed border-success/30 bg-success/5 px-6 py-12 text-center">
          <TrendingDown className="mx-auto h-8 w-8 text-success" />
          <p className="mt-3 font-medium">No active debt found</p>
          <p className="mt-1 text-sm text-muted-foreground">Your debt control center will appear here when balances are added.</p>
        </section>
      )}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card/55 p-3 backdrop-blur-xl">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-display text-lg tabular-nums">{value}</div>
    </div>
  );
}

function DetailCell({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 p-3">
      <Icon className="h-4 w-4 text-accent" />
      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
