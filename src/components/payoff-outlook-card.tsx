import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, Sparkles, TrendingDown } from "lucide-react";
import { useState } from "react";

import { money } from "@/lib/format";
import { formatMonthSpan, payoffImpact, payoffOutlook } from "@/lib/payoff-outlook";
import type { Debt } from "@/lib/types";
import { AnimatedMoney } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

const BOOSTS = [0, 100, 250, 500] as const;

/**
 * The debt-free date, with a control for trying a bigger payment.
 *
 * The full projection lives on /simulator; this is the everyday version, so
 * it answers one question — when does this end, and what would paying more
 * buy me — without leaving the screen.
 */
export function PayoffOutlookCard({
  debts,
  basePayment,
  hidden = false,
  className,
}: {
  debts: Debt[];
  basePayment: number;
  hidden?: boolean;
  className?: string;
}) {
  const [boost, setBoost] = useState<number>(0);

  const outlook = payoffOutlook(debts, basePayment + boost);
  const impact = payoffImpact(debts, basePayment, boost);
  const base = payoffOutlook(debts, basePayment);

  if (!outlook.hasDebt) {
    return (
      <section
        className={cn(
          "relative overflow-hidden rounded-[1.8rem] border border-success/25 bg-gradient-to-br from-success/[0.12] via-card to-accent/[0.05] p-5 shadow-card sm:p-6",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-success/15 text-success">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="font-display text-xl">No card debt to clear</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Nothing is accruing interest. Point spare cash at your emergency fund next.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "group relative overflow-hidden rounded-[1.8rem] border border-primary/25 bg-gradient-to-br from-primary/[0.14] via-card to-accent/[0.06] p-5 shadow-card sm:p-6",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-accent/15 blur-3xl transition-transform duration-700 motion-safe:group-hover:scale-110" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Debt-free target
          </div>
          <Link
            to="/simulator"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition hover:text-accent/80"
          >
            Full projection <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="numeric-display font-display text-[2.6rem] leading-none text-foreground sm:text-5xl">
              {outlook.feasible && outlook.debtFreeMonth ? outlook.debtFreeMonth : "Out of reach"}
            </div>
            <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
              {outlook.feasible && outlook.monthsRemaining !== null ? (
                <>
                  {formatMonthSpan(outlook.monthsRemaining)} at{" "}
                  <span className="font-semibold text-foreground">
                    {money(basePayment + boost, { whole: true })}
                  </span>{" "}
                  a month
                </>
              ) : (
                <>
                  {money(basePayment + boost, { whole: true })} a month doesn’t cover the{" "}
                  {money(outlook.minimums)} of minimums.
                </>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <Stat
              label="Balance"
              value={<AnimatedMoney value={outlook.totalBalance} hidden={hidden} short />}
            />
            <Stat
              label="Interest"
              value={<AnimatedMoney value={outlook.totalInterest} hidden={hidden} short />}
              tone="text-warning"
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            What if I paid more?
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {BOOSTS.map((amount) => {
              const selected = boost === amount;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setBoost(amount)}
                  aria-pressed={selected}
                  className={cn(
                    "ui-button min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold transition duration-200 active:scale-95",
                    selected
                      ? "border-accent/40 bg-accent/15 text-accent shadow-[0_0_22px_-12px_var(--accent)]"
                      : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:border-white/[0.16] hover:text-foreground",
                  )}
                >
                  {amount === 0 ? "Current plan" : `+${money(amount, { whole: true })}`}
                </button>
              );
            })}
          </div>

          <div
            aria-live="polite"
            className="mt-3 rounded-2xl border border-white/[0.07] bg-black/15 px-3.5 py-3 text-xs backdrop-blur-xl"
          >
            {boost === 0 ? (
              <span className="text-muted-foreground">
                Paying {money(basePayment, { whole: true })} a month clears everything by{" "}
                <span className="font-semibold text-foreground">{base.debtFreeMonth ?? "—"}</span>.
              </span>
            ) : impact.monthsSaved > 0 || impact.interestSaved > 0 ? (
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5 shrink-0 text-success" />
                <span className="font-semibold text-success">
                  {impact.monthsSaved} month{impact.monthsSaved === 1 ? "" : "s"} sooner
                </span>
                <span>and</span>
                <span className="font-semibold text-success">{money(impact.interestSaved)}</span>
                <span>less interest.</span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Not enough to shorten the plan by a whole month — try a larger amount.
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/10 px-3 py-2.5 backdrop-blur-xl">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("numeric-display mt-1 font-display text-lg", tone ?? "text-foreground")}>
        {value}
      </div>
    </div>
  );
}
