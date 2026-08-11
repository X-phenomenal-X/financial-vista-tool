import { CASH_BUFFER, highInterestDebt, totalCash, utilization, type CoachContext } from "./coach";

export type HealthFactor = {
  label: string;
  score: number;
  max: number;
  detail: string;
  tone: "good" | "watch" | "risk";
};

export type FinancialHealthResult = {
  score: number;
  label: "Needs attention" | "Fair" | "Good" | "Excellent";
  factors: HealthFactor[];
  nextBestAction: string;
};

export function financialHealth(ctx: CoachContext): FinancialHealthResult {
  const cash = totalCash(ctx);
  const cardDebt = highInterestDebt(ctx);
  const activeCards = (ctx.debts ?? []).filter(
    (d) => d.kind !== "car_loan" && Number(d.credit_limit || 0) > 0,
  );
  const avgUtil = activeCards.length
    ? activeCards.reduce((sum, d) => sum + utilization(d), 0) / activeCards.length
    : 0;
  const overdue = (ctx.debts ?? []).filter((d) => d.status === "past_due").length;
  const completedReminders = (ctx.reminders ?? []).filter((r) => r.completed).length;
  const totalReminders = (ctx.reminders ?? []).length;
  const reminderRate = totalReminders ? completedReminders / totalReminders : 1;
  const goals = ctx.goals ?? [];
  const goalProgress = goals.length
    ? goals.reduce(
        (sum, g) =>
          sum +
          Math.min(1, Number(g.current_amount || 0) / Math.max(1, Number(g.target_amount || 1))),
        0,
      ) / goals.length
    : 0;

  const cashScore =
    cash >= CASH_BUFFER * 2
      ? 25
      : cash >= CASH_BUFFER
        ? 18
        : Math.max(0, Math.round((cash / CASH_BUFFER) * 18));
  const utilizationScore = avgUtil <= 0.3 ? 25 : avgUtil <= 0.5 ? 18 : avgUtil <= 0.8 ? 10 : 3;
  const paymentScore = overdue === 0 ? Math.round(20 * reminderRate) : Math.max(0, 8 - overdue * 3);
  const debtScore = cardDebt <= 0 ? 20 : cardDebt < cash ? 15 : cardDebt < cash * 3 ? 9 : 4;
  const goalScore = Math.round(goalProgress * 10);

  const factors: HealthFactor[] = [
    {
      label: "Cash buffer",
      score: cashScore,
      max: 25,
      detail:
        cash >= CASH_BUFFER
          ? `You have at least the ${CASH_BUFFER.toLocaleString("en-CA", { style: "currency", currency: "CAD" })} safety buffer.`
          : "Your available cash is below the safety buffer.",
      tone: cashScore >= 18 ? "good" : cashScore >= 10 ? "watch" : "risk",
    },
    {
      label: "Credit utilization",
      score: utilizationScore,
      max: 25,
      detail: activeCards.length
        ? `Average utilization is ${Math.round(avgUtil * 100)}%.`
        : "No revolving credit balances are being tracked.",
      tone: utilizationScore >= 18 ? "good" : utilizationScore >= 10 ? "watch" : "risk",
    },
    {
      label: "Payment readiness",
      score: paymentScore,
      max: 20,
      detail: overdue
        ? `${overdue} debt item${overdue === 1 ? " is" : "s are"} past due.`
        : "No tracked debt is marked past due.",
      tone: paymentScore >= 15 ? "good" : paymentScore >= 8 ? "watch" : "risk",
    },
    {
      label: "High-interest debt load",
      score: debtScore,
      max: 20,
      detail: cardDebt
        ? `${cardDebt.toLocaleString("en-CA", { style: "currency", currency: "CAD" })} in high-interest debt is being tracked.`
        : "No high-interest debt is being tracked.",
      tone: debtScore >= 15 ? "good" : debtScore >= 8 ? "watch" : "risk",
    },
    {
      label: "Goal progress",
      score: goalScore,
      max: 10,
      detail: goals.length
        ? `${Math.round(goalProgress * 100)}% average progress across active goals.`
        : "Add a goal to start building this part of the score.",
      tone: goalScore >= 7 ? "good" : goalScore >= 3 ? "watch" : "risk",
    },
  ];

  const score = Math.max(
    0,
    Math.min(
      100,
      factors.reduce((sum, f) => sum + f.score, 0),
    ),
  );
  const label =
    score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 45 ? "Fair" : "Needs attention";
  const weakest = [...factors].sort((a, b) => a.score / a.max - b.score / b.max)[0];
  const nextBestAction =
    weakest.label === "Cash buffer"
      ? "Protect your cash buffer before making extra debt payments."
      : weakest.label === "Credit utilization"
        ? "Pay down the card with the highest utilization first."
        : weakest.label === "Payment readiness"
          ? "Clear any overdue item and confirm upcoming minimum payments."
          : weakest.label === "High-interest debt load"
            ? "Direct your next available extra dollar to high-interest debt."
            : "Choose one savings goal and automate a small contribution.";

  return { score, label, factors, nextBestAction };
}
