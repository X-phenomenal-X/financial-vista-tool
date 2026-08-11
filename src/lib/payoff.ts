import type { Debt } from "./types";

export interface PayoffMonth {
  month: string;
  totalBalance: number;
  interest: number;
  paid: { debtId: string; amount: number }[];
  cleared: string[];
  balances: { debtId: string; balance: number }[];
}

export interface PayoffResult {
  strategy: "avalanche" | "snowball";
  months: PayoffMonth[];
  totalInterest: number;
  debtFreeMonth: string | null;
  order: { id: string; name: string; apr: number; balance: number; clearedMonth: string | null }[];
  feasible: boolean;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
}

export function cardDebts(debts: Debt[]) {
  return debts.filter(
    (d) =>
      d.status !== "cleared" &&
      d.kind !== "car_loan" &&
      Number(d.balance) + Number(d.pending || 0) > 0,
  );
}

export function simulate(
  debts: Debt[],
  monthlyPayment: number,
  strategy: "avalanche" | "snowball",
  lumpSums: { monthIndex: number; amount: number }[] = [],
  maxMonths = 240,
): PayoffResult {
  const working = cardDebts(debts).map((d) => ({
    id: d.id,
    name: d.name,
    apr: Number(d.apr) / 100,
    balance: Number(d.balance) + Number(d.pending || 0),
    minimum: Number(d.minimum_payment) || 0,
    startBalance: Number(d.balance) + Number(d.pending || 0),
    clearedMonth: null as string | null,
  }));

  const order = () =>
    [...working]
      .filter((d) => d.balance > 0.01)
      .sort((a, b) => (strategy === "avalanche" ? b.apr - a.apr : a.balance - b.balance));

  const totalMin = working.reduce((s, d) => s + d.minimum, 0);
  const months: PayoffMonth[] = [];
  let totalInterest = 0;
  const cursor = new Date();
  cursor.setDate(1);
  let feasible = monthlyPayment >= totalMin;

  for (let m = 0; m < maxMonths; m++) {
    if (!working.some((d) => d.balance > 0.01)) break;
    cursor.setMonth(cursor.getMonth() + 1);
    const label = monthLabel(cursor);
    let interestThisMonth = 0;

    for (const d of working) {
      if (d.balance <= 0.01) continue;
      const i = d.balance * (d.apr / 12);
      d.balance += i;
      interestThisMonth += i;
    }
    totalInterest += interestThisMonth;

    let budget =
      monthlyPayment + lumpSums.filter((l) => l.monthIndex === m).reduce((s, l) => s + l.amount, 0);
    const paid: { debtId: string; amount: number }[] = [];
    const cleared: string[] = [];

    // Minimums first.
    for (const d of working) {
      if (d.balance <= 0.01 || budget <= 0) continue;
      const pay = Math.min(d.minimum, d.balance, budget);
      d.balance -= pay;
      budget -= pay;
      paid.push({ debtId: d.id, amount: pay });
    }

    // Then the selected strategy target.
    for (const d of order()) {
      if (budget <= 0) break;
      const pay = Math.min(budget, d.balance);
      d.balance -= pay;
      budget -= pay;
      const existing = paid.find((p) => p.debtId === d.id);
      if (existing) existing.amount += pay;
      else paid.push({ debtId: d.id, amount: pay });
    }

    for (const d of working) {
      if (d.balance <= 0.01 && !d.clearedMonth) {
        d.balance = 0;
        d.clearedMonth = label;
        cleared.push(d.id);
      }
    }

    months.push({
      month: label,
      totalBalance: working.reduce((s, d) => s + d.balance, 0),
      interest: interestThisMonth,
      paid,
      cleared,
      balances: working.map((d) => ({ debtId: d.id, balance: d.balance })),
    });

    if (m === maxMonths - 1 && working.some((d) => d.balance > 0.01)) feasible = false;
  }

  return {
    strategy,
    months,
    totalInterest,
    debtFreeMonth:
      working.every((d) => d.balance <= 0.01) && months.length
        ? months[months.length - 1].month
        : null,
    order: working
      .slice()
      .sort((a, b) => {
        const ai = months.findIndex((m) => m.cleared.includes(a.id));
        const bi = months.findIndex((m) => m.cleared.includes(b.id));
        return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      })
      .map((d) => ({
        id: d.id,
        name: d.name,
        apr: d.apr * 100,
        balance: d.startBalance,
        clearedMonth: d.clearedMonth,
      })),
    feasible,
  };
}

export function minimumsTotal(debts: Debt[]) {
  return cardDebts(debts).reduce((s, d) => s + Number(d.minimum_payment || 0), 0);
}
