// Rules-based financial coach. All logic operates on live app data.
// Deterministic so it works without any paid AI API.
import type { Account, Debt, BudgetCategory, Transaction, Reminder, Goal } from "./types";
import { money, dateShort, daysUntil } from "./format";

export interface CoachContext {
  accounts: Account[];
  debts: Debt[];
  budget: BudgetCategory[];
  transactions: Transaction[];
  reminders: Reminder[];
  goals: Goal[];
}

export const CASH_BUFFER = 500;
export const CC_TARGET = 1800;

const CASH_KINDS = new Set(["chequing", "savings", "money_master"]);
const RETIREMENT_KINDS = new Set(["rrsp", "dpsp"]);

export function totalCash(ctx: CoachContext) {
  return ctx.accounts.filter((a) => CASH_KINDS.has(a.kind)).reduce((s, a) => s + Number(a.balance), 0);
}
export function totalRetirement(ctx: CoachContext) {
  return ctx.accounts.filter((a) => RETIREMENT_KINDS.has(a.kind)).reduce((s, a) => s + Number(a.balance), 0);
}
export function highInterestDebt(ctx: CoachContext) {
  return ctx.debts
    .filter((d) => d.status !== "cleared" && (d.kind === "credit_card" || d.kind === "bnpl"))
    .reduce((s, d) => s + Number(d.balance) + Number(d.pending || 0), 0);
}
export function carLoanBalance(ctx: CoachContext) {
  return ctx.debts.filter((d) => d.kind === "car_loan").reduce((s, d) => s + Number(d.balance), 0);
}
export function netWorth(ctx: CoachContext) {
  const assets = ctx.accounts.reduce((s, a) => s + Number(a.balance), 0);
  const liab = ctx.debts.reduce((s, d) => s + Number(d.balance) + Number(d.pending || 0), 0);
  return assets - liab;
}
export function availableAboveBuffer(ctx: CoachContext) {
  return Math.max(0, totalCash(ctx) - CASH_BUFFER);
}
export function utilization(d: Debt) {
  if (!d.credit_limit || Number(d.credit_limit) <= 0) return 0;
  return (Number(d.balance) + Number(d.pending || 0)) / Number(d.credit_limit);
}

export function priorityOrder(ctx: CoachContext) {
  // Past-due first, then avalanche (APR desc), car loan last.
  return [...ctx.debts]
    .filter((d) => d.status !== "cleared")
    .sort((a, b) => {
      const pastA = a.status === "past_due" ? 0 : 1;
      const pastB = b.status === "past_due" ? 0 : 1;
      if (pastA !== pastB) return pastA - pastB;
      const carA = a.kind === "car_loan" ? 1 : 0;
      const carB = b.kind === "car_loan" ? 1 : 0;
      if (carA !== carB) return carA - carB;
      return Number(b.apr) - Number(a.apr);
    });
}

export function urgentActions(ctx: CoachContext): { text: string; tone: "danger" | "warning" | "info"; icon?: string }[] {
  const out: { text: string; tone: "danger" | "warning" | "info" }[] = [];
  ctx.debts
    .filter((d) => d.status === "past_due")
    .forEach((d) => out.push({ text: `${d.name}: past due — pay minimum ${money(d.minimum_payment)} today`, tone: "danger" }));
  ctx.debts.forEach((d) => {
    const u = utilization(d);
    if (u >= 1) out.push({ text: `${d.name} is ${(u * 100).toFixed(0)}% of limit`, tone: "danger" });
    else if (u >= 0.8) out.push({ text: `${d.name} at ${(u * 100).toFixed(0)}% utilization`, tone: "warning" });
  });
  ctx.debts
    .filter((d) => d.due_date && d.status !== "cleared")
    .map((d) => ({ d, days: daysUntil(d.due_date!) }))
    .filter((x) => x.days >= 0 && x.days <= 5)
    .sort((a, b) => a.days - b.days)
    .forEach(({ d, days }) => {
      const tone = days <= 2 ? "warning" : "info";
      out.push({ text: `${d.name} minimum (${money(d.minimum_payment)}) due in ${days} day${days === 1 ? "" : "s"} · ${dateShort(d.due_date!)}`, tone });
    });
  return out.slice(0, 3);
}

export function todayAction(ctx: CoachContext): string {
  const u = urgentActions(ctx);
  if (u.length) return u[0].text + ".";
  const order = priorityOrder(ctx).filter((d) => d.kind !== "car_loan");
  if (order.length) return `Focus extra payment on ${order[0].name} (${Number(order[0].apr).toFixed(2)}% APR). Keep ${money(CASH_BUFFER)} buffer.`;
  return "You're clear today — move any surplus into your emergency fund.";
}

export function paydayPlan(ctx: CoachContext, paycheck = 2800): string[] {
  const lines: string[] = [];
  const cash = totalCash(ctx);
  let running = cash + paycheck;
  lines.push(`Start: cash ${money(cash)} + paycheck ${money(paycheck)} = ${money(running)}.`);
  lines.push(`Hold ${money(CASH_BUFFER)} buffer → available: ${money(running - CASH_BUFFER)}.`);
  running -= CASH_BUFFER;
  const order = priorityOrder(ctx).filter((d) => d.kind !== "car_loan");
  let deploy = Math.min(running, CC_TARGET);
  for (const d of order) {
    if (deploy <= 0) break;
    const owed = Number(d.balance) + Number(d.pending || 0);
    const pay = Math.min(deploy, Math.max(Number(d.minimum_payment), owed));
    if (pay <= 0) continue;
    lines.push(`Pay ${money(pay)} → ${d.name} (${Number(d.apr).toFixed(2)}% APR).`);
    deploy -= pay;
    running -= pay;
  }
  lines.push(`Ending cash after CC payments: ${money(running + CASH_BUFFER)}.`);
  return lines;
}

function budgetProgress(ctx: CoachContext) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const rows = ctx.budget.filter((b) => b.kind !== "transfer" && b.kind !== "income");
  return rows.map((b) => {
    const actual = ctx.transactions
      .filter((t) => t.category === b.name && new Date(t.occurred_on) >= monthStart && t.type !== "transfer")
      .reduce((s, t) => s + Number(t.amount), 0);
    return { name: b.name, planned: Number(b.planned), actual, remaining: Number(b.planned) - actual };
  });
}

export function whereDidMoneyGo(ctx: CoachContext): string {
  const rows = budgetProgress(ctx).sort((a, b) => b.actual - a.actual).slice(0, 5);
  if (!rows.some((r) => r.actual > 0)) return "No spending logged this month yet. Add a few transactions and I'll break it down.";
  return "This month's top spend:\n" + rows.map((r) => `• ${r.name}: ${money(r.actual)}${r.planned > 0 ? ` of ${money(r.planned)}` : ""}`).join("\n") + "\n\nNext action: cut the biggest overshoot by $20 next week.";
}

export function howAmIDoing(ctx: CoachContext): string {
  const rows = budgetProgress(ctx);
  const over = rows.filter((r) => r.planned > 0 && r.actual > r.planned);
  const cash = totalCash(ctx);
  const parts = [
    `Cash: ${money(cash)} ${cash < CASH_BUFFER ? `— ⚠️ below ${money(CASH_BUFFER)} buffer.` : `(buffer ok).`}`,
    `High-interest debt: ${money(highInterestDebt(ctx))}.`,
  ];
  if (over.length) parts.push(`Over budget: ${over.map((o) => `${o.name} (+${money(o.actual - o.planned)})`).join(", ")}.`);
  else parts.push("No categories over budget yet.");
  parts.push(`Next action: ${todayAction(ctx)}`);
  return parts.join("\n");
}

export function canIAfford(ctx: CoachContext, amount: number, category?: string): string {
  if (!amount || amount <= 0) return "Enter an amount, e.g. \"Can I afford $80?\"";
  const cash = totalCash(ctx);
  const after = cash - amount;
  const bufferOk = after >= CASH_BUFFER;
  const catRow = category ? budgetProgress(ctx).find((r) => r.name.toLowerCase().includes(category.toLowerCase())) : null;
  const lines: string[] = [];
  lines.push(`After ${money(amount)}: cash ${money(after)}.`);
  if (!bufferOk) lines.push(`⚠️ Breaks your ${money(CASH_BUFFER)} buffer.`);
  if (catRow) {
    const remAfter = catRow.remaining - amount;
    lines.push(`${catRow.name}: ${money(catRow.actual)} of ${money(catRow.planned)} spent — ${remAfter >= 0 ? `${money(remAfter)} would remain.` : `⚠️ over by ${money(-remAfter)}.`}`);
  }
  const order = priorityOrder(ctx).filter((d) => d.kind !== "car_loan");
  if (order.length && bufferOk) {
    const saved = (Number(order[0].apr) / 100) * amount;
    lines.push(`Alt: ${money(amount)} → ${order[0].name} saves ~${money(saved)} interest/yr.`);
  }
  lines.push(`Next action: ${bufferOk && (!catRow || catRow.remaining >= amount) ? "yes, you can afford it — log it after." : "skip or scale down."}`);
  return lines.join("\n");
}

export function nextToPay(ctx: CoachContext): string {
  const order = priorityOrder(ctx);
  if (!order.length) return "Nothing to pay — you're clear.";
  const d = order[0];
  if (d.status === "past_due") return `Pay ${d.name} first — PAST DUE. Minimum ${money(d.minimum_payment)}. Next action: schedule the payment now.`;
  return `Pay ${d.name} next. APR ${Number(d.apr).toFixed(2)}%. Balance ${money(Number(d.balance) + Number(d.pending || 0))}. Next action: pay minimum ${money(d.minimum_payment)} plus whatever's above your ${money(CASH_BUFFER)} cash buffer.`;
}

export function coachAnswer(prompt: string, ctx: CoachContext): string {
  const p = prompt.toLowerCase().trim();
  if (!p) return "Ask me anything — try one of the quick prompts.";
  if (/pay.*(next|first)|what.*pay|which.*debt/.test(p)) return nextToPay(ctx);
  if (/afford/.test(p)) {
    const m = p.match(/\$?([\d,]+(?:\.\d+)?)/);
    if (!m) return "Tell me the amount and (optional) category — e.g. \"Can I afford $80 dining?\"";
    const amount = parseFloat(m[1].replace(/,/g, ""));
    const cat = p.replace(m[0], "").replace(/can i afford|for|on|\$/g, "").trim();
    return canIAfford(ctx, amount, cat || undefined);
  }
  if (/where.*money|spend|went/.test(p)) return whereDidMoneyGo(ctx);
  if (/payday|payment.*day|paycheck/.test(p)) return paydayPlan(ctx).join("\n") + "\n\nNext action: run this plan on your next pay date.";
  if (/how.*doing|month|status|health/.test(p)) return howAmIDoing(ctx);
  if (/buffer|cash/.test(p)) return `Cash buffer target: ${money(CASH_BUFFER)}. Current cash: ${money(totalCash(ctx))}. Available above buffer: ${money(availableAboveBuffer(ctx))}.`;
  if (/rrsp|dpsp|retire/.test(p)) return `Workplace retirement: ${money(totalRetirement(ctx))}. Keep matched contributions running — employer match is free money. Next action: don't reduce contributions to pay debt faster; the match beats the APR.`;
  return todayAction(ctx);
}

export const QUICK_PROMPTS = [
  "What should I pay next?",
  "Can I afford this?",
  "Where did my money go?",
  "What should I do on payday?",
  "How am I doing this month?",
];