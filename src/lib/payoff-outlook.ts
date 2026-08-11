import { cardDebts, minimumsTotal, simulate } from "./payoff";
import type { Debt } from "./types";

/**
 * A compact payoff summary that any screen can show.
 *
 * The full projection lives on /simulator, but the single number people
 * actually steer by — the date they stop being in debt — belongs on the
 * screens they open every day. This wraps simulate() so the dashboard and
 * debt tracker report exactly the same figure as the simulator.
 */
export interface PayoffOutlook {
  /** e.g. "Mar 2028", or null when the payment can't clear the debt. */
  debtFreeMonth: string | null;
  debtFreeDate: Date | null;
  monthsRemaining: number | null;
  totalInterest: number;
  totalBalance: number;
  monthlyPayment: number;
  minimums: number;
  /** False when the payment doesn't even cover the minimums. */
  feasible: boolean;
  hasDebt: boolean;
}

export type Strategy = "avalanche" | "snowball";

export function payoffOutlook(
  debts: Debt[],
  monthlyPayment: number,
  strategy: Strategy = "avalanche",
): PayoffOutlook {
  const active = cardDebts(debts);
  const totalBalance = active.reduce(
    (sum, d) => sum + Number(d.balance) + Number(d.pending || 0),
    0,
  );
  const minimums = minimumsTotal(debts);

  if (!active.length) {
    return {
      debtFreeMonth: null,
      debtFreeDate: null,
      monthsRemaining: null,
      totalInterest: 0,
      totalBalance: 0,
      monthlyPayment,
      minimums: 0,
      feasible: true,
      hasDebt: false,
    };
  }

  const result = simulate(debts, monthlyPayment, strategy);
  const cleared = result.debtFreeMonth !== null;
  const monthsRemaining = cleared ? result.months.length : null;

  // simulate() steps forward one month at a time from today, so the payoff
  // date is that many months out.
  let debtFreeDate: Date | null = null;
  if (monthsRemaining !== null) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthsRemaining);
    debtFreeDate = d;
  }

  return {
    debtFreeMonth: result.debtFreeMonth,
    debtFreeDate,
    monthsRemaining,
    totalInterest: result.totalInterest,
    totalBalance,
    monthlyPayment,
    minimums,
    feasible: result.feasible,
    hasDebt: true,
  };
}

export interface PayoffImpact {
  monthsSaved: number;
  interestSaved: number;
  debtFreeMonth: string | null;
}

/**
 * What paying `extra` more each month buys you, versus the base payment.
 *
 * This is the comparison people respond to — "another $100 a month gets you
 * out four months sooner and saves $380 of interest" — so it is computed
 * from the same simulation rather than estimated.
 */
export function payoffImpact(
  debts: Debt[],
  basePayment: number,
  extra: number,
  strategy: Strategy = "avalanche",
): PayoffImpact {
  const base = payoffOutlook(debts, basePayment, strategy);
  const boosted = payoffOutlook(debts, basePayment + extra, strategy);

  const monthsSaved =
    base.monthsRemaining !== null && boosted.monthsRemaining !== null
      ? Math.max(0, base.monthsRemaining - boosted.monthsRemaining)
      : 0;

  return {
    monthsSaved,
    interestSaved: Math.max(0, base.totalInterest - boosted.totalInterest),
    debtFreeMonth: boosted.debtFreeMonth,
  };
}

/** "1 yr 4 mo" — easier to feel than "16 months". */
export function formatMonthSpan(months: number | null) {
  if (months === null) return "—";
  if (months <= 0) return "Now";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} mo`;
  if (!rest) return `${years} yr`;
  return `${years} yr ${rest} mo`;
}
