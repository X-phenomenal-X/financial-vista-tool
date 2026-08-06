import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useAllData, usePaydayPlans, usePlanItems } from "@/lib/queries";
import {
  avalancheTarget,
  buildDefaultLines,
  computeRunning,
  nextPaydayISO,
  type PlanLine,
} from "@/lib/payday";
import { CASH_BUFFER, totalCash } from "@/lib/coach";
import { dateShort, money } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/payday")({
  head: () => ({
    meta: [
      { title: "Payday Planner — Wealthpilot" },
      {
        name: "description",
        content:
          "Plan every dollar of your next pay with a running balance, buffer warnings, and avalanche targeting.",
      },
    ],
  }),
  component: PaydayPage,
});

function PaydayPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ctx = useAllData(user?.id);
  const plansQuery = usePaydayPlans(user?.id);
  const plans = plansQuery.data ?? [];
  const [saving, setSaving] = useState(false);
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [hideBalances, setHideBalances] = useState(false);
  const [showInputs, setShowInputs] = useState(false);

  const defaults = useMemo(() => {
    const bills = ctx.budget
      .filter(
        (b) =>
          [
            "Rent",
            "Car payment",
            "Car insurance",
            "Phone",
            "Utilities",
            "Gas",
            "Groceries",
          ].includes(b.name) && Number(b.planned) > 0,
      )
      .map((b) => ({ name: b.name, planned: Number(b.planned) }));
    return buildDefaultLines(ctx.debts, bills);
  }, [ctx.debts, ctx.budget]);

  const [inited, setInited] = useState(false);
  const [payDate, setPayDate] = useState("");
  const [expectedPay, setExpectedPay] = useState(2800);
  const [startingCash, setStartingCash] = useState(0);
  const [buffer, setBuffer] = useState(CASH_BUFFER);
  const [allowance, setAllowance] = useState(0);
  const [extra, setExtra] = useState(0);
  const [lines, setLines] = useState<PlanLine[]>([]);
  const liveCash = totalCash(ctx);

  useEffect(() => {
    if (!user?.id || ctx.loading || ctx.error || inited) return;
    setPayDate(nextPaydayISO(ctx.reminders));
    setStartingCash(Number(liveCash.toFixed(2)));
    setLines(defaults);
    setInited(true);
  }, [ctx.error, ctx.loading, ctx.reminders, defaults, inited, liveCash, user?.id]);

  if (!user || ctx.loading || plansQuery.isLoading || !inited) return <PaydaySkeleton />;

  if (ctx.error || plansQuery.error) {
    return (
      <PaydayError
        onRetry={() => {
          void Promise.all([ctx.refetch(), plansQuery.refetch()]);
        }}
      />
    );
  }

  const target = avalancheTarget(ctx.debts);
  const extraLabel = target
    ? `Extra to ${target.name} (${Number(target.apr).toFixed(2)}% APR)`
    : "Extra debt payment";
  const calc = computeRunning(
    {
      payDate,
      expectedPay,
      startingCash,
      buffer,
      spendingAllowance: allowance,
      extraDebtPayment: extra,
      lines,
    },
    extraLabel,
  );
  const requiredTotal = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const decisionRoom = Math.max(0, calc.start - requiredTotal - buffer);
  const debtCapacity = Math.max(0, calc.ending + extra - buffer);
  const allocationPct = calc.start > 0 ? Math.min(100, (calc.allocated / calc.start) * 100) : 0;
  const safeToSpend = Math.max(0, calc.ending - buffer);
  const planHealthy = !calc.overspent && !calc.breaksBuffer;
  const displayMoney = (value: number) => (hideBalances ? "••••••" : money(value));

  function update(i: number, patch: Partial<PlanLine>) {
    setLines((ls) => ls.map((line, idx) => (idx === i ? { ...line, ...patch } : line)));
  }

  async function savePlan() {
    if (!user) return;
    setSaving(true);
    try {
      const { data: plan, error } = await supabase
        .from("payday_plans")
        .insert({
          user_id: user.id,
          pay_date: payDate,
          expected_pay: expectedPay,
          starting_cash: startingCash,
          buffer,
          spending_allowance: allowance,
          extra_debt_payment: extra,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      const items = [
        ...lines.map((line, i) => ({
          user_id: user.id,
          plan_id: plan.id,
          label: line.label,
          kind: line.kind,
          debt_id: line.debtId ?? null,
          amount: line.amount,
          sort_order: i,
        })),
        ...(allowance > 0
          ? [
              {
                user_id: user.id,
                plan_id: plan.id,
                label: "Spending allowance",
                kind: "allowance",
                debt_id: null,
                amount: allowance,
                sort_order: 900,
              },
            ]
          : []),
        ...(extra > 0
          ? [
              {
                user_id: user.id,
                plan_id: plan.id,
                label: extraLabel,
                kind: "avalanche",
                debt_id: target?.id ?? null,
                amount: extra,
                sort_order: 901,
              },
            ]
          : []),
      ];
      if (items.length) {
        const { error: itemError } = await supabase.from("payday_plan_items").insert(items);
        if (itemError) throw itemError;
      }
      await logAudit(
        user.id,
        "payday_plan",
        "created",
        `Saved payday plan for ${dateShort(payDate)} (${items.length} allocations)`,
        { total: calc.allocated },
        plan.id,
      );
      void qc.invalidateQueries({ queryKey: ["payday_plans", user.id] });
      toast.success("Plan saved");
      setOpenPlan(plan.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7 pb-10 sm:space-y-8">
      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <div className="eyebrow">Next pay · {dateShort(payDate)}</div>
          <h1 className="mt-2 font-display text-[2.25rem] leading-[0.98] tracking-[-0.035em] sm:text-5xl">
            Give this paycheque a job.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Protect the essentials first, keep your cash floor intact, then direct what is truly
            free.
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
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/18 blur-3xl transition-transform duration-700 ease-out motion-safe:group-hover:scale-110" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-primary/16 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)] lg:items-end">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
              <WalletCards className="h-3.5 w-3.5 text-accent" /> Cash after this plan
            </div>
            <div
              className={`numeric-display mt-5 truncate font-display text-[3.35rem] leading-none sm:text-7xl ${
                calc.overspent
                  ? "text-destructive"
                  : calc.breaksBuffer
                    ? "text-warning"
                    : "text-foreground"
              }`}
            >
              {displayMoney(calc.ending)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${
                  planHealthy
                    ? "border-success/20 bg-success/10 text-success"
                    : calc.overspent
                      ? "border-destructive/20 bg-destructive/10 text-destructive"
                      : "border-warning/20 bg-warning/10 text-warning"
                }`}
              >
                {planHealthy ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {planHealthy
                  ? "Buffer protected"
                  : calc.overspent
                    ? "Plan is overdrawn"
                    : "Buffer at risk"}
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(allocationPct)}% of available cash allocated
              </span>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/[0.09] bg-black/10 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Decision room
                </div>
                <div className="numeric-display mt-1 font-display text-2xl text-accent">
                  {displayMoney(decisionRoom)}
                </div>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-accent/15 bg-accent/[0.08] text-accent">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              After the bills and minimums below plus your {displayMoney(buffer)} protected cash
              floor.
            </p>
            {target && debtCapacity > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full rounded-xl"
                onClick={() => setExtra(Number(debtCapacity.toFixed(2)))}
              >
                Put available room to {target.name}
              </Button>
            )}
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-2.5">
          <HeroMetric label="Cash + pay" value={displayMoney(calc.start)} />
          <HeroMetric label="Committed" value={displayMoney(calc.allocated)} />
          <HeroMetric label="Free above floor" value={displayMoney(safeToSpend)} />
        </div>

        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              calc.overspent ? "bg-destructive" : calc.breaksBuffer ? "bg-warning" : "bg-accent"
            }`}
            style={{ width: `${allocationPct}%` }}
          />
        </div>

        {calc.overspent && (
          <p className="relative mt-4 flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-xs leading-5 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> This plan spends more than you
            will have. Cut {displayMoney(-calc.ending)} before saving it.
          </p>
        )}
        {!calc.overspent && calc.breaksBuffer && (
          <p className="relative mt-4 flex items-start gap-2 rounded-2xl border border-warning/20 bg-warning/10 px-3.5 py-3 text-xs leading-5 text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Your {displayMoney(buffer)} cash
            floor is short by {displayMoney(buffer - calc.ending)}. Reduce discretionary allocations
            first.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card shadow-card">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
          onClick={() => setShowInputs((value) => !value)}
          aria-expanded={showInputs}
        >
          <div>
            <div className="eyebrow">Plan controls</div>
            <h2 className="mt-1 font-display text-xl">Shape the paycheque</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Pay, cash floor, allowance, and extra debt payment.
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${showInputs ? "rotate-180" : ""}`}
          />
        </button>
        {showInputs && (
          <div className="animate-in fade-in slide-in-from-top-2 border-t border-border p-5 duration-200 sm:p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InputField label="Payday">
                <Input
                  type="date"
                  value={payDate}
                  onChange={(event) => setPayDate(event.target.value)}
                />
              </InputField>
              <InputField label="Expected pay">
                <Input
                  type="number"
                  step="0.01"
                  value={expectedPay}
                  onChange={(event) => setExpectedPay(Number(event.target.value))}
                />
              </InputField>
              <InputField label="Current cash">
                <Input
                  type="number"
                  step="0.01"
                  value={startingCash}
                  onChange={(event) => setStartingCash(Number(event.target.value))}
                />
              </InputField>
              <InputField label="Cash floor">
                <Input
                  type="number"
                  step="0.01"
                  value={buffer}
                  onChange={(event) => setBuffer(Number(event.target.value))}
                />
              </InputField>
              <InputField label="Spending allowance">
                <Input
                  type="number"
                  step="0.01"
                  value={allowance}
                  onChange={(event) => setAllowance(Number(event.target.value))}
                />
              </InputField>
              <InputField label="Extra debt payment">
                <Input
                  type="number"
                  step="0.01"
                  value={extra}
                  onChange={(event) => setExtra(Number(event.target.value))}
                />
              </InputField>
            </div>
            {target && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-accent/15 bg-accent/[0.06] p-3.5">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Extra debt money targets{" "}
                  <span className="font-medium text-foreground">{target.name}</span> at{" "}
                  {Number(target.apr).toFixed(2)}% APR. Your car loan stays on its normal schedule.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="commitments-heading">
        <SectionHeading
          eyebrow="Protect first"
          title="Bills & minimums"
          description={`${lines.length} allocation${lines.length === 1 ? "" : "s"} · ${displayMoney(requiredTotal)} before allowance or extra debt.`}
          id="commitments-heading"
        />
        <div className="mt-4 rounded-3xl border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="space-y-2.5">
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="grid grid-cols-[minmax(0,1fr)_6.25rem_2.25rem] items-center gap-2 rounded-2xl border border-border/70 bg-background/35 p-2.5"
              >
                <div className="min-w-0">
                  <Input
                    className="h-9 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                    value={line.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                  />
                  {line.note && (
                    <div className="truncate px-1 text-[10px] text-muted-foreground">
                      {line.note}
                    </div>
                  )}
                </div>
                <Input
                  className="h-9 text-right tabular-nums"
                  type="number"
                  step="0.01"
                  value={line.amount}
                  onChange={(event) => update(index, { amount: Number(event.target.value) })}
                />
                <button
                  type="button"
                  aria-label={`Remove ${line.label}`}
                  onClick={() =>
                    setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                  className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!lines.length && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <ShieldCheck className="mx-auto h-5 w-5 text-accent" />
                <p className="mt-2 text-sm font-medium">Nothing committed yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add anything that must be paid before your next paycheque.
                </p>
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3 rounded-xl"
            onClick={() =>
              setLines((current) => [
                ...current,
                { key: `custom-${Date.now()}`, label: "New item", kind: "bill", amount: 0 },
              ])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add commitment
          </Button>
        </div>
      </section>

      <section aria-labelledby="sequence-heading">
        <SectionHeading
          eyebrow="Sequence"
          title="See every dollar land"
          description="The running balance shows the exact point your cash floor would be crossed."
          id="sequence-heading"
        />
        <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 text-sm">
            <span className="text-muted-foreground">Cash + expected pay</span>
            <span className="numeric-display font-semibold">{displayMoney(calc.start)}</span>
          </div>
          <div className="divide-y divide-border/80 px-5">
            {calc.rows.map((row, index) => (
              <div
                key={`${row.label}-${index}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{row.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    −{displayMoney(row.amount)}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`numeric-display text-sm font-semibold ${row.running < 0 ? "text-destructive" : row.breaksBuffer ? "text-warning" : "text-foreground"}`}
                  >
                    {displayMoney(row.running)}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {row.running < 0 ? "Overdrawn" : row.breaksBuffer ? "Below floor" : "Remaining"}
                  </div>
                </div>
              </div>
            ))}
            {!calc.rows.length && (
              <p className="py-5 text-sm text-muted-foreground">
                Add commitments or discretionary allocations to build the sequence.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="sticky bottom-[5.25rem] z-20 rounded-2xl border border-white/[0.1] bg-background/90 p-2 shadow-elevated backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <Button
          className="h-12 w-full rounded-xl bg-violet-grad"
          onClick={savePlan}
          disabled={saving || !payDate}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save this plan · {displayMoney(calc.ending)} left
        </Button>
      </div>

      <section aria-labelledby="saved-heading">
        <SectionHeading
          eyebrow="History"
          title="Saved payday plans"
          description="Open a plan to mark allocations paid and compare actuals with the plan."
          id="saved-heading"
        />
        <div className="mt-4 space-y-3">
          {!plans.length && (
            <div className="rounded-3xl border border-dashed border-border bg-card p-7 text-center">
              <CalendarDays className="mx-auto h-6 w-6 text-accent" />
              <div className="mt-2 text-sm font-medium">Your first plan starts here</div>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                Save this paycheque plan and it will stay here as a check-off record.
              </p>
            </div>
          )}
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
            >
              <button
                type="button"
                onClick={() => setOpenPlan(openPlan === plan.id ? null : plan.id)}
                className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
                aria-expanded={openPlan === plan.id}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-accent/15 bg-accent/[0.08] text-accent">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">Payday {dateShort(plan.pay_date)}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    Pay {displayMoney(Number(plan.expected_pay))} · cash{" "}
                    {displayMoney(Number(plan.starting_cash))}
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${openPlan === plan.id ? "rotate-180" : ""}`}
                />
              </button>
              {openPlan === plan.id && <PlanDetail planId={plan.id} hideBalances={hideBalances} />}
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-3xl border border-border bg-card p-5 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <div className="eyebrow">Go deeper</div>
          <p className="mt-1 text-sm font-medium">
            Want to see how this extra payment changes your debt-free date?
          </p>
        </div>
        <Button asChild variant="outline" className="mt-4 rounded-xl sm:mt-0">
          <Link to="/simulator">
            Open payoff lab <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/10 p-3 backdrop-blur-xl">
      <div className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-[10px]">
        {label}
      </div>
      <div className="numeric-display mt-1.5 truncate text-sm font-semibold sm:text-base">
        {value}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <h2 id={id} className="mt-1 font-display text-2xl">
        {title}
      </h2>
      <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground sm:text-sm">
        {description}
      </p>
    </div>
  );
}

function PaydaySkeleton() {
  return (
    <div className="space-y-6 pb-10 animate-pulse">
      <div className="space-y-2 pt-1">
        <div className="h-3 w-28 rounded-full bg-secondary" />
        <div className="h-10 w-64 rounded-xl bg-secondary" />
        <div className="h-4 w-full max-w-md rounded-full bg-secondary" />
      </div>
      <div className="h-72 rounded-[2rem] bg-card" />
      <div className="h-24 rounded-3xl bg-card" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 rounded-3xl bg-card" />
        <div className="h-56 rounded-3xl bg-card" />
      </div>
    </div>
  );
}

function PaydayError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center py-10">
      <div className="w-full rounded-[2rem] border border-destructive/20 bg-card p-7 text-center shadow-card">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="mt-4 font-display text-2xl">Your payday data did not load</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Wealthpilot will not build a plan from partial numbers. Retry the live accounts, debts,
          budget, reminders, and saved plans first.
        </p>
        <Button type="button" className="mt-5 rounded-xl" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry live data
        </Button>
      </div>
    </div>
  );
}

function PlanDetail({ planId, hideBalances }: { planId: string; hideBalances: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const itemsQuery = usePlanItems(planId);
  const items = itemsQuery.data ?? [];

  async function togglePaid(id: string, paid: boolean, amount: number, actual: number | null) {
    const { error } = await supabase
      .from("payday_plan_items")
      .update({ paid: !paid, actual_amount: !paid ? (actual ?? amount) : null })
      .eq("id", id);
    if (error) {
      toast.error("Could not update this allocation.");
      return;
    }
    void qc.invalidateQueries({ queryKey: ["payday_plan_items", planId] });
  }

  async function setActual(id: string, value: number) {
    const { error } = await supabase
      .from("payday_plan_items")
      .update({ actual_amount: value })
      .eq("id", id);
    if (error) toast.error("Could not update the actual amount.");
    else void qc.invalidateQueries({ queryKey: ["payday_plan_items", planId] });
  }

  async function del() {
    const { error } = await supabase.from("payday_plans").delete().eq("id", planId);
    if (error) {
      toast.error("Could not delete this plan.");
      return;
    }
    await logAudit(user?.id, "payday_plan", "deleted", "Deleted a saved payday plan", {}, planId);
    void qc.invalidateQueries({ queryKey: ["payday_plans", user?.id] });
    toast.success("Plan deleted");
  }

  if (itemsQuery.isLoading)
    return (
      <div className="p-5 text-center">
        <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );

  if (itemsQuery.error) {
    return (
      <div className="border-t border-border p-5">
        <div className="rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This plan's allocations could not be loaded.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 rounded-xl"
            onClick={() => void itemsQuery.refetch()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const planned = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const actual = items.reduce((sum, item) => sum + Number(item.actual_amount ?? 0), 0);
  const paidCount = items.filter((item) => item.paid).length;
  const progress = items.length ? (paidCount / items.length) * 100 : 0;
  const displayMoney = (value: number) => (hideBalances ? "••••••" : money(value));

  return (
    <div className="border-t border-border p-4 sm:p-5">
      <div className="grid grid-cols-3 gap-2">
        <DetailMetric label="Planned" value={displayMoney(planned)} />
        <DetailMetric label="Actual" value={displayMoney(actual)} />
        <DetailMetric label="Paid" value={`${paidCount}/${items.length}`} />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-success transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 space-y-2.5">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-border/70 bg-background/35 p-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label={item.paid ? `Mark ${item.label} unpaid` : `Mark ${item.label} paid`}
                onClick={() =>
                  togglePaid(
                    item.id,
                    item.paid,
                    Number(item.amount),
                    item.actual_amount === null ? null : Number(item.actual_amount),
                  )
                }
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition ${item.paid ? "border-success bg-success/15 text-success" : "border-border text-muted-foreground hover:border-accent/30 hover:text-accent"}`}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-sm font-medium ${item.paid ? "line-through opacity-60" : ""}`}
                >
                  {item.label}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Planned {displayMoney(Number(item.amount))}
                </div>
              </div>
              <Input
                aria-label={`Actual amount for ${item.label}`}
                className="h-9 w-24 text-right tabular-nums"
                type="number"
                step="0.01"
                placeholder="actual"
                value={item.actual_amount === null ? "" : String(item.actual_amount)}
                onChange={(event) => setActual(item.id, Number(event.target.value))}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Variance {hideBalances ? "••••••" : money(actual - planned, { sign: true })}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete plan
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this payday plan?</AlertDialogTitle>
              <AlertDialogDescription>
                The plan and its allocations are removed. Your transactions and balances are
                untouched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={del}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/45 p-3">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="numeric-display mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
