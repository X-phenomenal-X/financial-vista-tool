import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  Gauge,
  Landmark,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  WalletCards,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { priorityOrder, utilization } from "@/lib/coach";
import { dateShort, daysUntil, money } from "@/lib/format";
import { useDebts } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({
    meta: [
      { title: "Debt Control — Wealthpilot" },
      {
        name: "description",
        content:
          "A premium debt command center for balances, APRs, utilization, due dates, and payoff priority.",
      },
    ],
  }),
  component: DebtsPage,
});

type Filter = "all" | "urgent" | "cards" | "loans";

function DebtsPage() {
  const { user } = useAuth();
  const debtQuery = useDebts(user?.id);
  const debts = useMemo(() => debtQuery.data ?? [], [debtQuery.data]);
  const [balancesVisible, setBalancesVisible] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ordered = useMemo(
    () =>
      priorityOrder({
        debts,
        accounts: [],
        budget: [],
        transactions: [],
        reminders: [],
        goals: [],
      }),
    [debts],
  );

  const metrics = useMemo(() => {
    const totalDebt = ordered.reduce(
      (sum, debt) => sum + Number(debt.balance) + Number(debt.pending || 0),
      0,
    );
    const highInterestDebt = ordered
      .filter((debt) => debt.kind !== "car_loan")
      .reduce((sum, debt) => sum + Number(debt.balance) + Number(debt.pending || 0), 0);
    const carLoan = ordered
      .filter((debt) => debt.kind === "car_loan")
      .reduce((sum, debt) => sum + Number(debt.balance) + Number(debt.pending || 0), 0);
    const listedMinimums = ordered.reduce(
      (sum, debt) => sum + Number(debt.minimum_payment || 0),
      0,
    );
    const monthlyInterest = ordered.reduce((sum, debt) => {
      const balance = Number(debt.balance) + Number(debt.pending || 0);
      return sum + (balance * (Number(debt.apr || 0) / 100)) / 12;
    }, 0);
    const weightedApr =
      totalDebt > 0
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
      if (!debt.due_date || debt.status === "past_due") return false;
      const days = daysUntil(debt.due_date);
      return days >= 0 && days <= 7;
    }).length;
    const pressuredCards = ordered.filter((debt) => utilization(debt) >= 0.8).length;
    return {
      totalDebt,
      highInterestDebt,
      carLoan,
      listedMinimums,
      monthlyInterest,
      weightedApr,
      aggregateUtilization,
      pastDue,
      dueSoon,
      pressuredCards,
    };
  }, [ordered]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return ordered.filter((debt) => {
      const util = utilization(debt);
      const days = debt.due_date ? daysUntil(debt.due_date) : null;
      const urgent =
        debt.status === "past_due" || util >= 0.8 || (days !== null && days >= 0 && days <= 7);
      const isCard = Number(debt.credit_limit || 0) > 0;
      const matchesFilter =
        filter === "all" ||
        (filter === "urgent" && urgent) ||
        (filter === "cards" && isCard) ||
        (filter === "loans" && !isCard);
      const matchesSearch =
        !search || `${debt.name} ${debt.notes || ""}`.toLowerCase().includes(search);
      return matchesFilter && matchesSearch;
    });
  }, [filter, ordered, query]);

  if (!user || debtQuery.isLoading) return <DebtSkeleton />;

  if (debtQuery.error) {
    return <DebtError onRetry={() => void debtQuery.refetch()} />;
  }

  if (ordered.length === 0) return <DebtEmptyState />;

  const focusDebt = ordered[0];
  const status =
    metrics.pastDue > 0
      ? {
          label: "Action needed",
          tone: "text-destructive",
          panel: "border-destructive/20 bg-destructive/10",
          icon: AlertTriangle,
        }
      : metrics.aggregateUtilization >= 0.8
        ? {
            label: "High utilization",
            tone: "text-warning",
            panel: "border-warning/20 bg-warning/10",
            icon: Gauge,
          }
        : {
            label: "On track",
            tone: "text-success",
            panel: "border-success/20 bg-success/10",
            icon: CheckCircle2,
          };
  const StatusIcon = status.icon;
  const highInterestShare =
    metrics.totalDebt > 0 ? (metrics.highInterestDebt / metrics.totalDebt) * 100 : 0;
  const attentionCount = metrics.pastDue + metrics.dueSoon + metrics.pressuredCards;
  const dateLabel = new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric" }).format(
    new Date(),
  );
  const showMoney = (value: number) => (balancesVisible ? money(value) : "••••");

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Debt position · {dateLabel}</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">
            Make every payment count.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            See the balances creating the most pressure, protect every minimum, and keep extra money
            pointed at the right target.
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setBalancesVisible((visible) => !visible)}
          aria-label={balancesVisible ? "Hide balances" : "Show balances"}
          aria-pressed={!balancesVisible}
          className="mt-1 shrink-0 rounded-2xl"
        >
          {balancesVisible ? <Eye /> : <EyeOff />}
        </Button>
      </header>

      <section className="group relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-hero p-5 shadow-elevated sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-60 w-60 rounded-full bg-destructive/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)] lg:items-end">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
              <WalletCards className="h-3.5 w-3.5 text-accent" /> Total outstanding
            </div>
            <div className="numeric-display mt-5 truncate font-display text-[3.35rem] leading-none sm:text-7xl">
              {showMoney(metrics.totalDebt)}
            </div>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              Weighted APR {metrics.weightedApr.toFixed(2)}% · roughly{" "}
              {showMoney(metrics.monthlyInterest)}
              {balancesVisible ? "" : " "} in interest at current balances this month.
            </p>
          </div>

          <div className="rounded-[1.55rem] border border-white/[0.09] bg-black/10 p-4 backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Pressure check
                </div>
                <div
                  className={`mt-1 flex items-center gap-2 font-display text-2xl ${status.tone}`}
                >
                  <StatusIcon className="h-5 w-5" /> {status.label}
                </div>
              </div>
              <div className={`rounded-2xl border px-3 py-2 text-right ${status.panel}`}>
                <div className={`numeric-display text-lg font-semibold ${status.tone}`}>
                  {attentionCount}
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  signals
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              <PressureRow
                label="High-interest share"
                value={`${Math.round(highInterestShare)}%`}
                progress={highInterestShare}
              />
              <PressureRow
                label="Card utilization"
                value={`${Math.round(metrics.aggregateUtilization * 100)}%`}
                progress={metrics.aggregateUtilization * 100}
                warning={metrics.aggregateUtilization >= 0.8}
              />
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-2.5">
          <MetricTile label="Listed minimums" value={showMoney(metrics.listedMinimums)} />
          <MetricTile label="High-interest" value={showMoney(metrics.highInterestDebt)} />
          <MetricTile
            label="Due / flagged"
            value={String(attentionCount)}
            tone={attentionCount > 0 ? "text-warning" : "text-success"}
          />
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Next move</div>
            <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">
              Keep the payoff moving
            </h2>
          </div>
        </div>
        <div className="scrollbar-none -mx-1 mt-4 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          <ActionCard
            to="/simulator"
            icon={Zap}
            eyebrow="Payoff lab"
            title="Model the fastest route"
            body="Compare avalanche and snowball with your live card balances."
          />
          <ActionCard
            to="/payday"
            icon={CalendarClock}
            eyebrow="Payday"
            title="Fund the next payment"
            body="Turn the next cheque into a protected, deliberate debt allocation."
          />
          <ActionCard
            to="/activity"
            icon={CheckCircle2}
            eyebrow="Activity"
            title="Verify what posted"
            body="Confirm recent payments before sending more money to the same balance."
          />
        </div>
      </section>

      {focusDebt && (
        <section className="relative overflow-hidden rounded-[1.8rem] border border-primary/25 bg-gradient-to-br from-primary/[0.14] via-card to-accent/[0.06] p-5 shadow-card sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/12 blur-3xl" />
          <div className="relative grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-glow">
                <Sparkles className="h-4 w-4" /> Priority 01 · best next move
              </div>
              <h2 className="mt-2 truncate font-display text-3xl">Focus on {focusDebt.name}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {focusDebt.status === "past_due"
                  ? `Bring the ${showMoney(Number(focusDebt.minimum_payment || 0))} listed minimum current before sending extra money elsewhere.`
                  : `Keep every minimum current, then direct extra debt money here at ${Number(focusDebt.apr || 0).toFixed(2)}% APR.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <FocusPill
                  label="Balance"
                  value={showMoney(Number(focusDebt.balance) + Number(focusDebt.pending || 0))}
                />
                <FocusPill label="APR" value={`${Number(focusDebt.apr || 0).toFixed(2)}%`} />
                <FocusPill
                  label="Minimum"
                  value={showMoney(Number(focusDebt.minimum_payment || 0))}
                />
              </div>
            </div>
            <Button asChild className="w-full rounded-2xl sm:w-auto">
              <Link to="/simulator">
                Test this plan <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Debt stack</div>
            <h2 className="mt-1 font-display text-2xl tracking-[-0.02em]">
              Every balance, in priority order
            </h2>
          </div>
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            {ordered.length} active balance{ordered.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="mt-4 rounded-[1.45rem] border border-border/80 bg-card/45 p-2.5 shadow-card sm:flex sm:items-center sm:gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search balances"
              className="h-11 rounded-2xl border-transparent bg-transparent pl-10 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="scrollbar-none mt-2 flex gap-1.5 overflow-x-auto sm:mt-0">
            {(["all", "urgent", "cards", "loans"] as Filter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                aria-pressed={filter === item}
                className={`min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-semibold capitalize transition active:scale-[0.98] ${
                  filter === item
                    ? "border-primary/35 bg-primary/15 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2.5">
          {filtered.map((debt) => {
            const priority = ordered.findIndex((item) => item.id === debt.id) + 1;
            const util = utilization(debt);
            const isCard = Number(debt.credit_limit || 0) > 0;
            const isCarLoan = debt.kind === "car_loan";
            const over100 = util >= 1;
            const over80 = util >= 0.8 && !over100;
            const days = debt.due_date ? daysUntil(debt.due_date) : null;
            const overdue = debt.status === "past_due" || (days !== null && days < 0);
            const dueSoon = days !== null && days >= 0 && days <= 7;
            const balance = Number(debt.balance) + Number(debt.pending || 0);
            const estimatedInterest = (balance * (Number(debt.apr || 0) / 100)) / 12;
            const expanded = expandedId === debt.id;
            const tone = overdue
              ? "border-destructive/30 bg-destructive/[0.035]"
              : over80 || dueSoon
                ? "border-warning/25 bg-warning/[0.025]"
                : "border-border bg-card/82";

            return (
              <article
                key={debt.id}
                className={`group overflow-hidden rounded-[1.55rem] border shadow-card transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-white/[0.14] ${tone}`}
              >
                <button
                  type="button"
                  className="w-full p-4 text-left active:bg-secondary/20 sm:p-5"
                  onClick={() => setExpandedId(expanded ? null : debt.id)}
                  aria-expanded={expanded}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                          isCard
                            ? "bg-primary/12 text-primary-glow"
                            : isCarLoan
                              ? "bg-accent/10 text-accent"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {isCard ? (
                          <CreditCard className="h-5 w-5" />
                        ) : isCarLoan ? (
                          <Landmark className="h-5 w-5" />
                        ) : (
                          <TrendingDown className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold sm:text-base">
                            {debt.name}
                          </div>
                          <span className="rounded-full bg-secondary/65 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            #{priority}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                          <span>{Number(debt.apr || 0).toFixed(2)}% APR</span>
                          {debt.due_date && <span>Due {dateShort(debt.due_date)}</span>}
                          {overdue && (
                            <span className="font-semibold text-destructive">Past due</span>
                          )}
                          {!overdue && dueSoon && (
                            <span className="font-semibold text-warning">Due soon</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="numeric-display font-display text-xl sm:text-2xl">
                        {showMoney(balance)}
                      </div>
                      <ChevronDown
                        className={`ml-auto mt-1 h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  {isCard && (
                    <div className="mt-4 pl-14">
                      <div className="flex items-center justify-between text-[10px] sm:text-xs">
                        <span className="text-muted-foreground">Credit utilization</span>
                        <span
                          className={
                            over100
                              ? "font-semibold text-destructive"
                              : over80
                                ? "font-semibold text-warning"
                                : "font-semibold text-success"
                          }
                        >
                          {(util * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, util * 100)}
                        className={`mt-2 h-1.5 ${
                          over100
                            ? "[&>*]:bg-destructive"
                            : over80
                              ? "[&>*]:bg-warning"
                              : "[&>*]:bg-accent"
                        }`}
                      />
                    </div>
                  )}
                </button>

                {expanded && (
                  <div className="border-t border-border/70 px-4 pb-5 pt-4 sm:px-5">
                    {(overdue || over80) && (
                      <div
                        className={`mb-4 flex items-start gap-2 rounded-2xl px-3 py-3 text-xs leading-5 ${
                          overdue
                            ? "bg-destructive/10 text-destructive"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {overdue
                            ? "Pay at least the listed minimum immediately to bring this account current."
                            : "Utilization is above 80%. Reducing this balance should relieve overall credit pressure."}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <DetailCell
                        icon={Gauge}
                        label="Interest / mo"
                        value={showMoney(estimatedInterest)}
                      />
                      <DetailCell
                        icon={CalendarClock}
                        label="Listed minimum"
                        value={`${showMoney(Number(debt.minimum_payment || 0))}${debt.minimum_estimated ? " est." : ""}`}
                      />
                      {debt.credit_limit ? (
                        <DetailCell
                          icon={CreditCard}
                          label="Credit limit"
                          value={showMoney(Number(debt.credit_limit))}
                        />
                      ) : (
                        <DetailCell
                          icon={Landmark}
                          label="Type"
                          value={formatDebtKind(debt.kind)}
                        />
                      )}
                      <DetailCell
                        icon={ShieldAlert}
                        label="Status"
                        value={overdue ? "Past due" : dueSoon ? "Due soon" : "Current"}
                      />
                    </div>

                    {Number(debt.pending || 0) !== 0 && (
                      <div className="mt-3 rounded-2xl bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
                        Balance includes pending activity of {showMoney(Number(debt.pending || 0))}.
                      </div>
                    )}
                    {debt.notes && (
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">{debt.notes}</p>
                    )}

                    {!isCarLoan && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="mt-4 w-full rounded-2xl"
                      >
                        <Link to="/simulator">
                          Test extra payments <ArrowRight />
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-[1.55rem] border border-dashed border-border bg-card/35 px-6 py-10 text-center">
              <Search className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No matching balances</p>
              <p className="mt-1 text-xs text-muted-foreground">Try another search or filter.</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 rounded-xl"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </section>

      {metrics.carLoan > 0 && (
        <section className="flex items-start gap-3 rounded-[1.45rem] border border-border bg-card/55 p-4 text-sm text-muted-foreground">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="leading-6">
            Your {showMoney(metrics.carLoan)} car-loan balance stays visible in total debt, but
            Wealthpilot keeps it outside the high-interest payoff simulator so card debt remains the
            extra-payment priority.
          </p>
        </section>
      )}
    </div>
  );
}

function PressureRow({
  label,
  value,
  progress,
  warning = false,
}: {
  label: string;
  value: string;
  progress: number;
  warning?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={warning ? "font-semibold text-warning" : "font-semibold text-foreground"}>
          {value}
        </span>
      </div>
      <Progress
        value={Math.min(100, Math.max(0, progress))}
        className={`mt-2 h-1.5 ${warning ? "[&>*]:bg-warning" : "[&>*]:bg-primary-glow"}`}
      />
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/10 p-3.5 backdrop-blur-xl">
      <div className="truncate text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground sm:text-[10px]">
        {label}
      </div>
      <div className={`numeric-display mt-1.5 truncate font-display text-lg sm:text-xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function ActionCard({
  to,
  icon: Icon,
  eyebrow,
  title,
  body,
}: {
  to: "/simulator" | "/payday" | "/activity";
  icon: typeof Zap;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group min-w-[17.5rem] max-w-sm flex-1 snap-start rounded-[1.55rem] border border-border bg-card/78 p-5 shadow-card transition duration-200 active:scale-[0.99] motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-primary/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/12 text-primary-glow">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
      </div>
      <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {eyebrow}
      </div>
      <h3 className="mt-1 font-display text-2xl">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{body}</p>
    </Link>
  );
}

function FocusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/[0.08] bg-black/10 px-3 py-1.5 backdrop-blur-xl">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="numeric-display font-semibold text-foreground">{value}</span>
    </div>
  );
}

function DetailCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-secondary/40 p-3">
      <Icon className="h-4 w-4 text-accent" />
      <div className="mt-2 truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[10px]">
        {label}
      </div>
      <div className="numeric-display mt-1 truncate text-xs font-semibold sm:text-sm">{value}</div>
    </div>
  );
}

function formatDebtKind(kind: string) {
  return kind
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function DebtSkeleton() {
  return (
    <div className="space-y-7 pb-10" aria-busy="true" aria-label="Loading debt control">
      <div className="space-y-3 pt-1">
        <div className="skeleton-shimmer h-3 w-36 rounded-full bg-muted" />
        <div className="skeleton-shimmer h-10 w-72 max-w-[80vw] rounded-xl bg-muted" />
        <div className="skeleton-shimmer h-4 w-full max-w-lg rounded bg-muted" />
      </div>
      <div className="skeleton-shimmer h-[23rem] rounded-[2rem] bg-card" />
      <div className="scrollbar-none flex gap-3 overflow-hidden">
        <div className="skeleton-shimmer h-40 min-w-[17.5rem] rounded-[1.55rem] bg-card" />
        <div className="skeleton-shimmer h-40 min-w-[17.5rem] rounded-[1.55rem] bg-card" />
      </div>
      <div className="skeleton-shimmer h-44 rounded-[1.8rem] bg-card" />
      <div className="space-y-2.5">
        <div className="skeleton-shimmer h-24 rounded-[1.55rem] bg-card" />
        <div className="skeleton-shimmer h-24 rounded-[1.55rem] bg-card" />
      </div>
    </div>
  );
}

function DebtError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-destructive/20 bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle />
        </div>
        <div className="eyebrow mt-5 text-destructive">Debt data interrupted</div>
        <h1 className="mt-2 font-display text-3xl">Your debt position did not refresh.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Wealthpilot could not load your balances. Your saved debt data has not been changed.
        </p>
        <Button type="button" onClick={onRetry} className="mt-5 rounded-2xl">
          <RefreshCw /> Try again
        </Button>
      </div>
    </div>
  );
}

function DebtEmptyState() {
  return (
    <div className="flex min-h-[62vh] items-center justify-center pb-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 text-center shadow-elevated sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
          <TrendingDown />
        </div>
        <div className="eyebrow mt-5">Debt control</div>
        <h1 className="mt-2 font-display text-3xl">No active debt found.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Active card and loan balances will appear here when they are added to Wealthpilot.
        </p>
        <Button asChild variant="outline" className="mt-5 rounded-2xl">
          <Link to="/uploads">
            Import a statement <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
