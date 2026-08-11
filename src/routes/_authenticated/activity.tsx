import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  Clock3,
  CreditCard,
  Plus,
  Search,
  Tag,
  Wallet,
  X,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useAccounts, useTransactions } from "@/lib/queries";
import { countsAsSpend, spendAmount } from "@/lib/coach";
import { groupByDate, money, parseLocalDate } from "@/lib/format";
import { AnimatedMoney } from "@/components/ui/animated-number";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Wealthpilot" },
      { name: "description", content: "All money in and out, grouped by day." },
    ],
  }),
  component: Activity,
});

const FILTERS = [
  ["all", "All"],
  ["expense", "Expenses"],
  ["income", "Income"],
  ["debt_payment", "Payments"],
  ["transfer", "Transfers"],
] as const;

function typeIcon(type: string) {
  if (type === "transfer") return <ArrowLeftRight className="h-4 w-4" />;
  if (type === "income") return <ArrowDown className="h-4 w-4" />;
  if (type === "debt_payment") return <CreditCard className="h-4 w-4" />;
  return <ArrowUp className="h-4 w-4" />;
}

function Activity() {
  const { user } = useAuth();
  const { data: tx = [], isLoading } = useTransactions(user?.id);
  const { data: accounts = [] } = useAccounts(user?.id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.name]));
    return (id: string | null) => (id ? (map.get(id) ?? null) : null);
  }, [accounts]);

  const filtered = useMemo(
    () =>
      tx.filter((t) => {
        if (filter !== "all" && t.type !== filter) return false;
        if (!query) return true;
        const haystack = `${t.description ?? ""} ${t.category ?? ""} ${t.type}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      }),
    [tx, query, filter],
  );

  // This month's totals, so the screen opens with a summary rather than a
  // wall of rows. Transfers are excluded from both sides — the rent payment
  // and the roommates' share would otherwise inflate income and spending.
  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = tx.filter((t) => parseLocalDate(t.occurred_on) >= monthStart);
    const inbound = thisMonth
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + spendAmount(t), 0);
    const outbound = thisMonth.filter(countsAsSpend).reduce((sum, t) => sum + spendAmount(t), 0);
    return { inbound, outbound, net: inbound - outbound, count: thisMonth.length };
  }, [tx]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const dayTotal = (items: Transaction[]) =>
    items.filter(countsAsSpend).reduce((sum, t) => sum + spendAmount(t), 0);

  return (
    <div className="space-y-5 pb-8">
      <header>
        <div className="eyebrow">Activity</div>
        <h1 className="mt-2 font-display text-[2rem] leading-none sm:text-4xl">Money in and out</h1>
      </header>

      <section className="relative overflow-hidden rounded-[1.8rem] border border-white/[0.1] bg-hero p-5 shadow-card sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-accent/12 blur-3xl" />
        <div className="relative">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            This month
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <SummaryTile label="In" value={summary.inbound} tone="text-success" />
            <SummaryTile label="Out" value={summary.outbound} tone="text-foreground" />
            <SummaryTile
              label="Net"
              value={summary.net}
              tone={summary.net >= 0 ? "text-success" : "text-warning"}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {summary.count} transaction{summary.count === 1 ? "" : "s"} logged this month. Transfers
            are excluded from both totals.
          </p>
        </div>
      </section>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search description or category"
            aria-label="Search transactions"
            className="pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="ui-button absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "ui-button shrink-0 rounded-full px-3.5 py-2 font-semibold transition duration-200 active:scale-95",
                filter === value
                  ? "bg-violet-grad text-primary-foreground shadow-card"
                  : "border border-white/[0.07] bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      )}

      {!isLoading && grouped.length === 0 && (
        <div className="rounded-[1.6rem] border border-dashed border-white/[0.12] bg-card/60 p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-grad text-primary-foreground shadow-card">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-semibold">
            {tx.length ? "Nothing matches that filter" : "No transactions yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-muted-foreground">
            {tx.length
              ? "Try a different search term or switch the filter back to All."
              : "Log one with the + button, or import a statement to bring in a whole month at once."}
          </p>
          {tx.length ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="ui-button mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold hover:bg-white/[0.08]"
            >
              Clear filters
            </button>
          ) : (
            <Link
              to="/uploads"
              className="ui-button mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-violet-grad px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-card"
            >
              <Plus className="h-3.5 w-3.5" /> Import a statement
            </Link>
          )}
        </div>
      )}

      {grouped.map((group) => {
        const spent = dayTotal(group.items);
        return (
          <section key={group.key}>
            <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              {spent > 0 && (
                <div className="numeric-display text-xs text-muted-foreground">
                  {money(spent)} out
                </div>
              )}
            </div>

            <div className="divide-y divide-white/[0.055] overflow-hidden rounded-[1.4rem] border border-white/[0.075] bg-card/70">
              {group.items.map((t) => {
                const amount = Number(t.amount);
                const isTransfer = t.type === "transfer";
                const isIncome = t.type === "income";
                const expanded = expandedId === t.id;
                const account = accountName(t.account_id);

                return (
                  <div key={t.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition duration-200 hover:bg-white/[0.035] active:bg-white/[0.05]"
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full transition",
                          isTransfer
                            ? "bg-white/[0.06] text-muted-foreground"
                            : isIncome
                              ? "bg-success/15 text-success"
                              : "bg-white/[0.06] text-muted-foreground",
                        )}
                      >
                        {typeIcon(t.type)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {t.description || t.category || t.type.replace("_", " ")}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="truncate">{t.category ?? t.type.replace("_", " ")}</span>
                          {!t.cleared && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                              <Clock3 className="h-2.5 w-2.5" /> pending
                            </span>
                          )}
                        </span>
                      </span>

                      <span
                        className={cn(
                          "numeric-display shrink-0 font-display text-base",
                          isTransfer
                            ? "text-muted-foreground"
                            : isIncome
                              ? "text-success"
                              : "text-foreground",
                        )}
                      >
                        {money(amount, { sign: !isTransfer })}
                      </span>
                    </button>

                    {expanded && (
                      <dl className="animate-in fade-in slide-in-from-top-1 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/[0.05] bg-black/15 px-4 py-3 text-xs duration-200">
                        <Detail icon={Tag} label="Type" value={t.type.replace("_", " ")} />
                        <Detail icon={Wallet} label="Account" value={account ?? "Not linked"} />
                        {t.need_want && (
                          <Detail icon={Tag} label="Need / want" value={t.need_want} />
                        )}
                        <Detail
                          icon={t.cleared ? Check : Clock3}
                          label="Status"
                          value={t.cleared ? "Cleared" : "Pending"}
                        />
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/15 p-3 backdrop-blur-xl">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <AnimatedMoney
        value={value}
        short
        className={cn("numeric-display mt-1.5 block truncate font-display text-xl", tone)}
      />
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-0.5 truncate capitalize text-foreground">{value}</dd>
    </div>
  );
}
