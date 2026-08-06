import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAllData } from "@/lib/queries";
import {
  carLoanBalance,
  highInterestDebt,
  netWorth,
  totalCash,
  totalRetirement,
} from "@/lib/coach";
import { money } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

const netWorthDb = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/_authenticated/net-worth")({
  head: () => ({
    meta: [
      { title: "Net worth — Wealthpilot" },
      {
        name: "description",
        content: "Track your total position, wealth trend, assets, and liabilities in one view.",
      },
    ],
  }),
  component: NetWorthPage,
});

type Snapshot = {
  snapshot_date: string;
  assets_total: number;
  liabilities_total: number;
  net_worth: number;
};

type ChartMetric = "net_worth" | "assets_total" | "liabilities_total";

const CHART_METRICS: Record<
  ChartMetric,
  { label: string; shortLabel: string; stroke: string; fillId: string }
> = {
  net_worth: {
    label: "Net worth",
    shortLabel: "Net",
    stroke: "var(--accent)",
    fillId: "netWorthFill",
  },
  assets_total: {
    label: "Assets",
    shortLabel: "Assets",
    stroke: "var(--success)",
    fillId: "assetFill",
  },
  liabilities_total: {
    label: "Liabilities",
    shortLabel: "Debt",
    stroke: "var(--warning)",
    fillId: "liabilityFill",
  },
};

function NetWorthPage() {
  const { user } = useAuth();
  const ctx = useAllData(user?.id);
  const client = useQueryClient();
  const [hideBalances, setHideBalances] = useState(false);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("net_worth");
  const [range, setRange] = useState<30 | 90 | 180>(90);
  const [showAllPositions, setShowAllPositions] = useState(false);

  const history = useQuery({
    queryKey: ["net-worth-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await netWorthDb
        .from("net_worth_snapshots")
        .select("snapshot_date,assets_total,liabilities_total,net_worth")
        .eq("user_id", user!.id)
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
  const assets = ctx.accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const liabilities = ctx.debts.reduce(
    (sum, debt) => sum + Number(debt.balance || 0) + Number(debt.pending || 0),
    0,
  );
  const otherAssets = assets - cash - retirement;
  const otherLiabilities = liabilities - cards - car;

  useEffect(() => {
    if (!user?.id || ctx.loading || ctx.error) return;
    const save = async () => {
      const { error } = await netWorthDb.from("net_worth_snapshots").upsert(
        {
          user_id: user.id,
          snapshot_date: new Date().toISOString().slice(0, 10),
          cash_total: cash,
          retirement_total: retirement,
          other_assets_total: otherAssets,
          high_interest_debt_total: cards,
          car_loan_total: car,
          other_liabilities_total: otherLiabilities,
        },
        { onConflict: "user_id,snapshot_date" },
      );
      if (!error) client.invalidateQueries({ queryKey: ["net-worth-history", user.id] });
    };
    void save();
  }, [
    user?.id,
    ctx.loading,
    ctx.error,
    cash,
    retirement,
    otherAssets,
    cards,
    car,
    otherLiabilities,
    client,
  ]);

  if (!user || ctx.loading || history.isLoading) return <NetWorthSkeleton />;

  if (ctx.error || history.error) {
    return (
      <NetWorthError
        onRetry={() => {
          void Promise.all([ctx.refetch(), history.refetch()]);
        }}
      />
    );
  }

  if (ctx.accounts.length === 0 && ctx.debts.length === 0) return <NetWorthEmptyState />;

  const points = (history.data ?? []).map((point) => ({
    ...point,
    assets_total: Number(point.assets_total),
    liabilities_total: Number(point.liabilities_total),
    net_worth: Number(point.net_worth),
  }));
  const visiblePoints = points.slice(-range);
  const first = points[0]?.net_worth ?? currentNetWorth;
  const change = currentNetWorth - first;
  const improving = change >= 0;
  const changePct = Math.abs(first) > 0 ? (change / Math.abs(first)) * 100 : null;
  const compositionTotal = Math.max(1, Math.max(0, assets) + Math.max(0, liabilities));
  const assetShare = Math.round((Math.max(0, assets) / compositionTotal) * 100);
  const assetRows = [...ctx.accounts].sort(
    (a, b) => Number(b.balance || 0) - Number(a.balance || 0),
  );
  const debtRows = [...ctx.debts]
    .map((debt) => ({
      ...debt,
      liveBalance: Number(debt.balance || 0) + Number(debt.pending || 0),
    }))
    .sort((a, b) => b.liveBalance - a.liveBalance);
  const topAsset = assetRows[0];
  const topDebt = debtRows[0];
  const chartConfig = CHART_METRICS[chartMetric];
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const displayMoney = (value: number) => (hideBalances ? "••••••" : money(value));

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Wealth position · {dateLabel}</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">
            Know what you own. Know what you owe.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            One live view of the balance sheet behind your financial progress.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setHideBalances((value) => !value)}
          aria-label={hideBalances ? "Show balances" : "Hide balances"}
          aria-pressed={hideBalances}
          className="mt-1 shrink-0 rounded-2xl"
        >
          {hideBalances ? <EyeOff /> : <Eye />}
        </Button>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-success/12 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-primary/18 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)] lg:items-end">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Current net worth
            </div>
            <AnimatedMoney
              value={currentNetWorth}
              hidden={hideBalances}
              className="numeric-display mt-5 block truncate font-display text-[3.35rem] leading-none sm:text-7xl"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${
                  improving
                    ? "border-success/20 bg-success/10 text-success"
                    : "border-destructive/20 bg-destructive/10 text-destructive"
                }`}
              >
                {improving ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {hideBalances ? "••••" : money(Math.abs(change))}
                {changePct !== null ? ` · ${Math.abs(changePct).toFixed(1)}%` : ""}
              </div>
              <span className="text-xs text-muted-foreground">since tracking began</span>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/[0.09] bg-black/10 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Position mix
                </div>
                <div className="mt-1 font-display text-2xl">{assetShare}% assets</div>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-success/15 bg-success/[0.08] text-success">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div
              className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-warning/35"
              aria-hidden="true"
            >
              <div
                className="rounded-full bg-success transition-[width] duration-700 ease-out"
                style={{ width: `${assetShare}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Assets</div>
                <div className="numeric-display mt-1 font-semibold text-success">
                  {displayMoney(assets)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">Liabilities</div>
                <div className="numeric-display mt-1 font-semibold text-warning">
                  {displayMoney(liabilities)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-2.5">
          <HeroMetric label="Cash" value={displayMoney(cash)} icon={CircleDollarSign} />
          <HeroMetric label="Retirement" value={displayMoney(retirement)} icon={Landmark} />
          <HeroMetric
            label="Card debt"
            value={displayMoney(cards)}
            icon={CreditCard}
            tone={cards > 0 ? "text-warning" : "text-success"}
          />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Trajectory</div>
              <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">Your wealth curve</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                A daily snapshot is saved automatically when this page opens.
              </p>
            </div>
            <div className="flex rounded-xl border border-border bg-background/35 p-1">
              {([30, 90, 180] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRange(days)}
                  aria-pressed={range === days}
                  className={`min-h-9 rounded-lg px-2.5 text-[11px] font-semibold transition active:scale-[0.97] ${
                    range === days
                      ? "bg-primary/15 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {days === 180 ? "6M" : `${days}D`}
                </button>
              ))}
            </div>
          </div>

          <div className="scrollbar-none -mx-1 mt-5 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {(Object.keys(CHART_METRICS) as ChartMetric[]).map((metric) => (
              <button
                key={metric}
                type="button"
                onClick={() => setChartMetric(metric)}
                aria-pressed={chartMetric === metric}
                className={`min-h-10 shrink-0 snap-start rounded-full border px-3.5 text-xs font-semibold transition active:scale-[0.98] ${
                  chartMetric === metric
                    ? "border-primary/30 bg-primary/12 text-foreground"
                    : "border-border/70 bg-secondary/25 text-muted-foreground hover:text-foreground"
                }`}
              >
                {CHART_METRICS[metric].shortLabel}
              </button>
            ))}
          </div>

          <div className="mt-4 h-64 sm:h-72">
            {visiblePoints.length < 2 ? (
              <div className="grid h-full place-items-center rounded-[1.35rem] border border-dashed border-border bg-secondary/20 px-6 text-center">
                <div className="max-w-xs">
                  <BarChart3 className="mx-auto h-6 w-6 text-accent" />
                  <h3 className="mt-3 font-semibold">Your first point is on the map.</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Wealthpilot will turn daily snapshots into a trend as your history grows.
                  </p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visiblePoints} margin={{ left: 0, right: 4, top: 12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.015} />
                    </linearGradient>
                    <linearGradient id="assetFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0.015} />
                    </linearGradient>
                    <linearGradient id="liabilityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--warning)" stopOpacity={0.015} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 5" opacity={0.12} />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.24} />
                  <XAxis
                    dataKey="snapshot_date"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value) =>
                      new Date(`${value}T12:00:00`).toLocaleDateString("en-CA", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
                    contentStyle={{
                      borderRadius: "16px",
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      boxShadow: "var(--shadow-card)",
                    }}
                    formatter={(value) => [money(Number(value)), chartConfig.label]}
                    labelFormatter={(label) =>
                      new Date(`${label}T12:00:00`).toLocaleDateString("en-CA", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey={chartMetric}
                    stroke={chartConfig.stroke}
                    fill={`url(#${chartConfig.fillId})`}
                    strokeWidth={3}
                    activeDot={{ r: 5, strokeWidth: 2, fill: "var(--background)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-card sm:p-6">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/15 bg-primary/10 text-primary-glow">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="eyebrow mt-5 text-primary-glow">Wealthpilot signal</div>
          <h2 className="mt-2 font-display text-2xl leading-tight">
            {currentNetWorth >= 0
              ? improving
                ? "Your balance sheet is moving forward."
                : "Protect the position you have built."
              : improving
                ? "The gap is closing."
                : "Debt is still setting the pace."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {currentNetWorth >= 0
              ? `${displayMoney(assets)} in assets is carrying ${displayMoney(liabilities)} in liabilities. Keep both sides moving in the right direction.`
              : `Liabilities are ahead of assets by ${displayMoney(Math.abs(currentNetWorth))}. High-cost debt reduction has the clearest direct effect on this number.`}
          </p>
          <Button asChild variant="outline" className="mt-5 w-full rounded-2xl">
            <Link to="/scenario-planner">
              Test a scenario <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Position map</div>
            <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">
              What builds the number
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAllPositions((value) => !value)}
            className="rounded-xl"
            aria-expanded={showAllPositions}
          >
            {showAllPositions ? "Less" : "Details"}
            <ChevronDown
              className={`transition-transform duration-200 ${showAllPositions ? "rotate-180" : ""}`}
            />
          </Button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <PositionCard
            title="Assets"
            total={assets}
            hidden={hideBalances}
            tone="success"
            icon={WalletCards}
            summary={
              topAsset
                ? `${topAsset.name} is currently your largest tracked asset.`
                : "Add an account to start building your asset view."
            }
            rows={assetRows.map((account) => ({
              id: account.id,
              name: account.name,
              kind: humanize(account.kind),
              value: Number(account.balance || 0),
            }))}
            expanded={showAllPositions}
          />
          <PositionCard
            title="Liabilities"
            total={liabilities}
            hidden={hideBalances}
            tone="warning"
            icon={Landmark}
            summary={
              topDebt
                ? `${topDebt.name} is currently your largest tracked liability.`
                : "No tracked liabilities are weighing on your position."
            }
            rows={debtRows.map((debt) => ({
              id: debt.id,
              name: debt.name,
              kind: humanize(debt.kind),
              value: debt.liveBalance,
            }))}
            expanded={showAllPositions}
          />
        </div>
      </section>

      <section>
        <div>
          <div className="eyebrow">Move the balance sheet</div>
          <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">Choose your next lever</h2>
        </div>
        <div className="scrollbar-none -mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible">
          <ActionCard
            to="/debts"
            icon={CreditCard}
            title="Reduce liabilities"
            caption="See the debt that moves net worth fastest."
            tone="text-warning"
          />
          <ActionCard
            to="/goals"
            icon={Sparkles}
            title="Build assets"
            caption="Keep the next funded milestone visible."
            tone="text-success"
          />
          <ActionCard
            to="/activity"
            icon={RefreshCw}
            title="Refresh balances"
            caption="Review the activity behind your live position."
            tone="text-accent"
          />
        </div>
      </section>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  icon: Icon,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  icon: typeof CircleDollarSign;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-[1.25rem] border border-white/[0.075] bg-black/10 p-3 backdrop-blur-xl sm:p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="mt-3 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground sm:text-[10px]">
        {label}
      </div>
      <div className={`numeric-display mt-1 truncate font-display text-base sm:text-xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function PositionCard({
  title,
  total,
  hidden,
  tone,
  icon: Icon,
  summary,
  rows,
  expanded,
}: {
  title: string;
  total: number;
  hidden: boolean;
  tone: "success" | "warning";
  icon: typeof WalletCards;
  summary: string;
  rows: { id: string; name: string; kind: string; value: number }[];
  expanded: boolean;
}) {
  const toneClasses =
    tone === "success"
      ? "border-success/15 bg-success/[0.07] text-success"
      : "border-warning/15 bg-warning/[0.07] text-warning";

  return (
    <article className="overflow-hidden rounded-[1.65rem] border border-border bg-card shadow-card">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className={`grid h-11 w-11 place-items-center rounded-2xl border ${toneClasses}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {title}
            </div>
            <div className="numeric-display mt-1 font-display text-2xl">
              {hidden ? "••••••" : money(total)}
            </div>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">{summary}</p>
      </div>
      {expanded && rows.length > 0 && (
        <div className="border-t border-border/70 bg-background/20 px-5 py-2 sm:px-6">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex min-h-14 items-center justify-between gap-4 border-b border-border/50 py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{row.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{row.kind}</div>
              </div>
              <div className="numeric-display shrink-0 font-display text-lg">
                {hidden ? "••••" : money(row.value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function ActionCard({
  to,
  icon: Icon,
  title,
  caption,
  tone,
}: {
  to: "/debts" | "/goals" | "/activity";
  icon: typeof CreditCard;
  title: string;
  caption: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="group min-w-[16.5rem] snap-start rounded-[1.55rem] border border-border bg-card p-5 shadow-card transition active:scale-[0.985] motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-primary/20 lg:min-w-0"
    >
      <Icon className={`h-5 w-5 ${tone}`} />
      <div className="mt-5 flex items-end justify-between gap-3">
        <h3 className="font-display text-xl">{title}</h3>
        <ArrowRight
          className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 ${tone}`}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{caption}</p>
    </Link>
  );
}

function AnimatedMoney({
  value,
  hidden,
  className,
}: {
  value: number;
  hidden: boolean;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayValue(value);
      return;
    }

    const duration = 620;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={className}>{hidden ? "••••••" : money(displayValue)}</span>;
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function NetWorthSkeleton() {
  return (
    <div className="space-y-7 pb-10" aria-busy="true" aria-label="Loading net worth">
      <div className="space-y-3 pt-1">
        <div className="skeleton-shimmer h-3 w-40 rounded-full bg-muted" />
        <div className="skeleton-shimmer h-10 w-80 max-w-[85vw] rounded-xl bg-muted" />
        <div className="skeleton-shimmer h-4 w-full max-w-lg rounded bg-muted" />
      </div>
      <div className="skeleton-shimmer h-[27rem] rounded-[2rem] bg-card sm:h-80" />
      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="skeleton-shimmer h-96 rounded-[1.75rem] bg-card" />
        <div className="skeleton-shimmer h-72 rounded-[1.75rem] bg-card" />
      </div>
      <span className="sr-only">Loading your Wealthpilot net worth.</span>
    </div>
  );
}

function NetWorthError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-destructive/20 bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle />
        </div>
        <div className="eyebrow mt-5 text-destructive">Net worth data interrupted</div>
        <h1 className="mt-2 font-display text-3xl">Your position did not refresh.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Wealthpilot could not load your balances or wealth history. Your saved financial data has
          not been changed.
        </p>
        <Button type="button" onClick={onRetry} className="mt-5 rounded-2xl">
          <RefreshCw /> Try again
        </Button>
      </div>
    </div>
  );
}

function NetWorthEmptyState() {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary-glow">
          <WalletCards />
        </div>
        <div className="eyebrow mt-5">Net worth</div>
        <h1 className="mt-2 font-display text-3xl">Build your first balance sheet.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Add accounts and debts to turn this page into a live view of what you own, what you owe,
          and how the gap changes over time.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild className="rounded-2xl">
            <Link to="/settings">
              Add financial data <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl">
            <Link to="/uploads">
              <Upload /> Import statement
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
