import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarRange, ChevronRight, ShieldCheck, WalletCards } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cash-flow")({
  head: () => ({
    meta: [
      { title: "Cash Flow Forecast — Wealthpilot" },
      { name: "description", content: "A 30-day forecast using your live balances and recurring transactions." },
    ],
  }),
  component: CashFlowForecastPage,
});

type RecurringRow = {
  id: string;
  name: string;
  amount: number | string;
  kind: "income" | "expense" | "transfer" | "debt_payment" | "subscription" | "bill";
  next_due_date: string;
  is_active: boolean;
};

type AccountRow = {
  id: string;
  name: string;
  kind: string;
  balance: number | string;
};

type ForecastEvent = {
  id: string;
  name: string;
  date: string;
  amount: number;
  direction: "in" | "out";
  projectedBalance: number;
};

const CASH_KINDS = new Set(["chequing", "savings", "money_master", "cash"]);

function money(value: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function CashFlowForecastPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [accountsResult, recurringResult] = await Promise.all([
        supabase.from("accounts").select("id,name,kind,balance").eq("user_id", user.id),
        supabase
          .from("recurring_transactions")
          .select("id,name,amount,kind,next_due_date,is_active")
          .eq("user_id", user.id)
          .eq("is_active", true),
      ]);

      if (!cancelled) {
        setAccounts((accountsResult.data ?? []) as AccountRow[]);
        setRecurring((recurringResult.data ?? []) as RecurringRow[]);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const data = useMemo(() => {
    const currentCash = accounts
      .filter((account) => CASH_KINDS.has(account.kind))
      .reduce((sum, account) => sum + Number(account.balance || 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);

    const sourceEvents = recurring
      .filter((item) => {
        const due = new Date(`${item.next_due_date}T00:00:00`);
        return due >= today && due <= end;
      })
      .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));

    let running = currentCash;
    const events: ForecastEvent[] = sourceEvents.map((item) => {
      const direction = item.kind === "income" ? "in" : "out";
      const amount = Number(item.amount || 0);
      running += direction === "in" ? amount : -amount;
      return {
        id: item.id,
        name: item.name,
        date: item.next_due_date,
        amount,
        direction,
        projectedBalance: running,
      };
    });

    const incoming = events.filter((event) => event.direction === "in").reduce((sum, event) => sum + event.amount, 0);
    const outgoing = events.filter((event) => event.direction === "out").reduce((sum, event) => sum + event.amount, 0);
    const lowest = events.reduce((min, event) => Math.min(min, event.projectedBalance), currentCash);

    return {
      currentCash,
      projectedCash: currentCash + incoming - outgoing,
      incoming,
      outgoing,
      lowest,
      events,
    };
  }, [accounts, recurring]);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-grad shadow-card">
          <CalendarRange className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-2xl">Cash Flow Forecast</h1>
          <p className="text-sm text-muted-foreground">Your next 30 days, based on saved balances and recurring payments.</p>
        </div>
      </header>

      <section className="rounded-3xl bg-violet-grad p-5 text-primary-foreground shadow-card">
        <div className="text-xs uppercase tracking-[0.18em] opacity-80">Projected cash in 30 days</div>
        <div className="mt-2 font-display text-4xl">{loading ? "—" : money(data.projectedCash)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="opacity-70">Current cash</div>
            <div className="mt-1 font-semibold">{money(data.currentCash)}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="opacity-70">Lowest point</div>
            <div className="mt-1 font-semibold">{money(data.lowest)}</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <ArrowUpRight className="h-5 w-5 text-success" />
          <div className="mt-2 text-xs text-muted-foreground">Incoming</div>
          <div className="font-display text-xl">{money(data.incoming)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <ArrowDownRight className="h-5 w-5 text-destructive" />
          <div className="mt-2 text-xs text-muted-foreground">Outgoing</div>
          <div className="font-display text-xl">{money(data.outgoing)}</div>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <h2 className="font-medium">Forecast status</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.lowest < 0
            ? `Your projected balance drops below zero. Review bills and payday allocations before the low point.`
            : data.lowest < 500
              ? `Your cash buffer falls below $500. Avoid optional spending until the next income event.`
              : `Your forecast stays above the $500 safety buffer for the next 30 days.`}
        </p>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Timeline</h2>
          <Link to="/bill-calendar" className="text-xs text-accent">Open bill calendar</Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Building forecast…</div>
        ) : data.events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center">
            <WalletCards className="mx-auto h-6 w-6 text-muted-foreground" />
            <div className="mt-2 text-sm font-medium">No upcoming recurring activity</div>
            <p className="mt-1 text-xs text-muted-foreground">Add bills, subscriptions, or recurring income to create a useful forecast.</p>
            <Link to="/bill-calendar" className="mt-3 inline-flex items-center gap-1 text-sm text-accent">
              Add recurring items <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {data.events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <div className={event.direction === "in" ? "grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success" : "grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive"}>
                  {event.direction === "in" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{event.name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(`${event.date}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</div>
                </div>
                <div className="text-right">
                  <div className={event.direction === "in" ? "text-sm font-semibold text-success" : "text-sm font-semibold text-destructive"}>
                    {event.direction === "in" ? "+" : "−"}{money(event.amount)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Balance {money(event.projectedBalance)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-[10px] text-muted-foreground">
        Forecasts use saved app data only. Actual balances may differ when transactions are missing or dates change.
      </p>
    </div>
  );
}
