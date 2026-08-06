import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, WalletCards, Landmark, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import { totalCash, totalRetirement, highInterestDebt, carLoanBalance, netWorth } from "@/lib/coach";
import { money } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/net-worth")({
  head: () => ({ meta: [{ title: "Net worth — Wealthpilot" }] }),
  component: NetWorthPage,
});

type Snapshot = {
  snapshot_date: string;
  assets_total: number;
  liabilities_total: number;
  net_worth: number;
};

function NetWorthPage() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const client = useQueryClient();
  const db = supabase as any;

  const history = useQuery({
    queryKey: ["net-worth-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("net_worth_snapshots")
        .select("snapshot_date,assets_total,liabilities_total,net_worth")
        .order("snapshot_date", { ascending: true })
        .limit(180);
      if (error) throw error;
      return (data ?? []) as Snapshot[];
    },
  });

  const cash = totalCash(ctx);
  const retirement = totalRetirement(ctx);
  const cards = highInterestDebt(ctx);
  const car = carLoanBalance(ctx);
  const currentNetWorth = netWorth(ctx);
  const assets = cash + retirement;
  const liabilities = cards + car;

  useEffect(() => {
    if (!user?.id || ctx.loading) return;
    const save = async () => {
      const { error } = await db.from("net_worth_snapshots").upsert(
        {
          user_id: user.id,
          snapshot_date: new Date().toISOString().slice(0, 10),
          cash_total: cash,
          retirement_total: retirement,
          high_interest_debt_total: cards,
          car_loan_total: car,
        },
        { onConflict: "user_id,snapshot_date" },
      );
      if (!error) client.invalidateQueries({ queryKey: ["net-worth-history", user.id] });
    };
    void save();
  }, [user?.id, ctx.loading, cash, retirement, cards, car, client]);

  if (ctx.loading || history.isLoading) {
    return <div className="pt-20 text-center text-muted-foreground">Loading net worth…</div>;
  }

  const points = history.data ?? [];
  const first = points[0]?.net_worth ?? currentNetWorth;
  const change = currentNetWorth - Number(first);
  const improving = change >= 0;

  return (
    <div className="space-y-6 pb-8">
      <header>
        <p className="text-sm text-muted-foreground">Financial position</p>
        <h1 className="font-display text-3xl">Net worth</h1>
      </header>

      <section className="overflow-hidden rounded-3xl bg-hero p-6 shadow-elevated">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current net worth</div>
        <div className="mt-2 font-display text-5xl tabular-nums">{money(currentNetWorth)}</div>
        <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${improving ? "bg-emerald-500/15 text-emerald-300" : "bg-destructive/15 text-destructive"}`}>
          {improving ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          {money(Math.abs(change))} since tracking began
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <WalletCards className="h-5 w-5 text-accent" />
          <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Assets</div>
          <div className="font-display text-2xl tabular-nums">{money(assets)}</div>
          <div className="mt-2 text-xs text-muted-foreground">Cash {money(cash)} · Retirement {money(retirement)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <Landmark className="h-5 w-5 text-warning" />
          <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Liabilities</div>
          <div className="font-display text-2xl tabular-nums">{money(liabilities)}</div>
          <div className="mt-2 text-xs text-muted-foreground">Cards {money(cards)} · Car {money(car)}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h2 className="font-semibold">Net worth trend</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">A daily snapshot is saved automatically when you open this page.</p>
        <div className="mt-5 h-64">
          {points.length < 2 ? (
            <div className="grid h-full place-items-center rounded-xl bg-secondary/30 text-center text-sm text-muted-foreground">
              Your first snapshot is saved. The trend appears as your history grows.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="currentColor" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="currentColor" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="snapshot_date" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(value) => money(Number(value))} labelFormatter={(label) => new Date(`${label}T12:00:00`).toLocaleDateString("en-CA")} />
                <Area type="monotone" dataKey="net_worth" stroke="currentColor" fill="url(#netWorthFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold">What moves this number</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Cash and retirement</span><span className="text-emerald-300">+{money(assets)}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Credit cards and car loan</span><span className="text-destructive">−{money(liabilities)}</span></div>
        </div>
      </section>
    </div>
  );
}
