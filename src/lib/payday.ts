import type { Debt, Reminder } from "./types";
import { priorityOrder } from "./coach";
import { toDateKey } from "./format";

export interface PlanLine {
  key: string;
  label: string;
  kind: "bill" | "minimum" | "avalanche" | "allowance" | "buffer" | "savings";
  amount: number;
  debtId?: string | null;
  locked?: boolean;
  note?: string;
}

export interface PlannerInputs {
  payDate: string;
  expectedPay: number;
  startingCash: number;
  buffer: number;
  spendingAllowance: number;
  extraDebtPayment: number;
  lines: PlanLine[];
}

export function buildDefaultLines(debts: Debt[], budgetBills: { name: string; planned: number }[]): PlanLine[] {
  const lines: PlanLine[] = [];
  const active = debts.filter((d) => d.status !== "cleared");
  // Overdue first.
  active
    .filter((d) => d.status === "past_due")
    .forEach((d) =>
      lines.push({ key: `overdue-${d.id}`, label: `${d.name} — PAST DUE minimum`, kind: "minimum", amount: Number(d.minimum_payment) || 0, debtId: d.id, locked: true, note: "Overdue — pay first" }),
    );
  // Bills before next payday.
  budgetBills.forEach((b, i) => lines.push({ key: `bill-${i}-${b.name}`, label: b.name, kind: "bill", amount: Number(b.planned) || 0 }));
  // Remaining card minimums in avalanche order.
  priorityOrder({ debts: active, accounts: [], budget: [], transactions: [], reminders: [], goals: [] })
    .filter((d) => d.status !== "past_due" && d.kind !== "car_loan")
    .forEach((d) =>
      lines.push({ key: `min-${d.id}`, label: `${d.name} minimum`, kind: "minimum", amount: Number(d.minimum_payment) || 0, debtId: d.id, note: `${Number(d.apr).toFixed(2)}% APR` }),
    );
  return lines.filter((l) => l.amount > 0);
}

export function avalancheTarget(debts: Debt[]) {
  return priorityOrder({ debts, accounts: [], budget: [], transactions: [], reminders: [], goals: [] }).filter((d) => d.kind !== "car_loan")[0] ?? null;
}

export interface RunningRow { label: string; amount: number; running: number; kind: PlanLine["kind"]; breaksBuffer: boolean; }

export function computeRunning(inp: PlannerInputs, extraLabel: string) {
  const rows: RunningRow[] = [];
  let running = inp.startingCash + inp.expectedPay;
  const start = running;
  const all: { label: string; amount: number; kind: PlanLine["kind"] }[] = [
    ...inp.lines.map((l) => ({ label: l.label, amount: l.amount, kind: l.kind })),
    ...(inp.spendingAllowance > 0 ? [{ label: "Spending allowance", amount: inp.spendingAllowance, kind: "allowance" as const }] : []),
    ...(inp.extraDebtPayment > 0 ? [{ label: extraLabel, amount: inp.extraDebtPayment, kind: "avalanche" as const }] : []),
  ];
  for (const a of all) {
    running -= a.amount;
    rows.push({ label: a.label, amount: a.amount, running, kind: a.kind, breaksBuffer: running < inp.buffer });
  }
  const allocated = all.reduce((s, a) => s + a.amount, 0);
  return { rows, start, ending: running, allocated, overspent: running < 0, breaksBuffer: running < inp.buffer };
}

export function nextPaydayISO(reminders: Reminder[]) {
  const payday = reminders.find((r) => r.kind === "payday" && !r.completed);
  if (payday) return payday.due_at.slice(0, 10);
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toDateKey(d);
}
