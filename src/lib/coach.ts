// Rules-based financial coach. All logic operates on live app data.
// Deterministic so it works without a paid AI API.
import type {
  Account,
  BudgetCategory,
  Debt,
  Goal,
  PaydayPlan,
  Reminder,
  StatementImport,
  Transaction,
} from "./types";
import { dateShort, daysUntil, money, parseLocalDate, startOfDay } from "./format";

export interface CoachContext {
  accounts: Account[];
  debts: Debt[];
  budget: BudgetCategory[];
  transactions: Transaction[];
  reminders: Reminder[];
  goals: Goal[];
  paydayPlans?: PaydayPlan[];
  statementImports?: StatementImport[];
}

export const CASH_BUFFER = 500;
export const CC_TARGET = 1800;

const CASH_KINDS = new Set(["chequing", "savings", "money_master"]);
const RETIREMENT_KINDS = new Set(["rrsp", "dpsp"]);

export function totalCash(ctx: CoachContext) {
  return ctx.accounts.filter((a) => CASH_KINDS.has(a.kind)).reduce((sum, account) => sum + Number(account.balance), 0);
}

export function totalRetirement(ctx: CoachContext) {
  return ctx.accounts.filter((a) => RETIREMENT_KINDS.has(a.kind)).reduce((sum, account) => sum + Number(account.balance), 0);
}

export function highInterestDebt(ctx: CoachContext) {
  return ctx.debts
    .filter((d) => d.status !== "cleared" && (d.kind === "credit_card" || d.kind === "bnpl"))
    .reduce((sum, debt) => sum + Number(debt.balance) + Number(debt.pending || 0), 0);
}

export function carLoanBalance(ctx: CoachContext) {
  return ctx.debts.filter((d) => d.kind === "car_loan").reduce((sum, debt) => sum + Number(debt.balance), 0);
}

export function netWorth(ctx: CoachContext) {
  const assets = ctx.accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const liabilities = ctx.debts.reduce((sum, debt) => sum + Number(debt.balance) + Number(debt.pending || 0), 0);
  return assets - liabilities;
}

export function availableAboveBuffer(ctx: CoachContext) {
  return Math.max(0, totalCash(ctx) - CASH_BUFFER);
}

export function utilization(debt: Debt) {
  if (!debt.credit_limit || Number(debt.credit_limit) <= 0) return 0;
  return (Number(debt.balance) + Number(debt.pending || 0)) / Number(debt.credit_limit);
}

export function priorityOrder(ctx: CoachContext) {
  // Past-due first, then avalanche (APR descending), car loan last.
  return [...ctx.debts]
    .filter((debt) => debt.status !== "cleared")
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

function activePaydayPlan(ctx: CoachContext) {
  return [...(ctx.paydayPlans ?? [])]
    .filter((plan) => plan.status === "active")
    .sort((a, b) => new Date(b.pay_date).getTime() - new Date(a.pay_date).getTime())[0] ?? null;
}

function nextPayday(ctx: CoachContext) {
  const futurePlans = (ctx.paydayPlans ?? [])
    .filter((plan) => startOfDay(plan.pay_date).getTime() >= startOfDay(new Date()).getTime())
    .sort((a, b) => new Date(a.pay_date).getTime() - new Date(b.pay_date).getTime());
  if (futurePlans[0]) return futurePlans[0].pay_date;

  const reminder = ctx.reminders
    .filter((item) => item.kind === "payday" && !item.completed && !item.paused)
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];
  return reminder?.due_at ?? null;
}

function upcomingMinimums(ctx: CoachContext, through?: string | null) {
  const end = through ? startOfDay(through).getTime() : Date.now() + 14 * 86400000;
  return ctx.debts
    .filter((debt) => {
      if (debt.status === "cleared" || debt.kind === "car_loan") return false;
      if (debt.status === "past_due") return true;
      return Boolean(debt.due_date && startOfDay(debt.due_date).getTime() <= end);
    })
    .reduce((sum, debt) => sum + Number(debt.minimum_payment || 0), 0);
}

function pendingImports(ctx: CoachContext) {
  return (ctx.statementImports ?? []).filter((item) => item.status === "pending");
}

export function urgentActions(ctx: CoachContext): { text: string; tone: "danger" | "warning" | "info" }[] {
  const actions: { text: string; tone: "danger" | "warning" | "info" }[] = [];

  ctx.debts
    .filter((debt) => debt.status === "past_due")
    .forEach((debt) => actions.push({ text: `${debt.name}: past due — pay minimum ${money(debt.minimum_payment)} today`, tone: "danger" }));

  ctx.debts.forEach((debt) => {
    const used = utilization(debt);
    if (used >= 1) actions.push({ text: `${debt.name} is ${(used * 100).toFixed(0)}% of its limit`, tone: "danger" });
    else if (used >= 0.8) actions.push({ text: `${debt.name} is at ${(used * 100).toFixed(0)}% utilization`, tone: "warning" });
  });

  ctx.debts
    .filter((debt) => debt.due_date && debt.status !== "cleared")
    .map((debt) => ({ debt, days: daysUntil(debt.due_date!) }))
    .filter((item) => item.days >= 0 && item.days <= 5)
    .sort((a, b) => a.days - b.days)
    .forEach(({ debt, days }) => {
      actions.push({
        text: `${debt.name} minimum (${money(debt.minimum_payment)}) due in ${days} day${days === 1 ? "" : "s"} · ${dateShort(debt.due_date!)}`,
        tone: days <= 2 ? "warning" : "info",
      });
    });

  const imports = pendingImports(ctx);
  if (imports.length) actions.push({ text: `${imports.length} statement import${imports.length === 1 ? " needs" : "s need"} review`, tone: "info" });

  return actions.slice(0, 3);
}

export function todayAction(ctx: CoachContext): string {
  const urgent = urgentActions(ctx);
  if (urgent.length) return `${urgent[0].text}. Next action: handle that item now.`;

  const plan = activePaydayPlan(ctx);
  if (plan && startOfDay(plan.pay_date).getTime() <= Date.now()) {
    return `Your saved payday plan for ${dateShort(plan.pay_date)} is active. Next action: mark its allocations paid or enter actual amounts.`;
  }

  const order = priorityOrder(ctx).filter((debt) => debt.kind !== "car_loan");
  if (order.length) {
    return `Focus extra money on ${order[0].name} (${Number(order[0].apr).toFixed(2)}% APR) while keeping ${money(CASH_BUFFER)} cash. Next action: confirm all minimums are scheduled.`;
  }

  return "No urgent debt action today. Next action: move available surplus into your emergency fund.";
}

export function paydayPlan(ctx: CoachContext, paycheck = 2800): string[] {
  const saved = activePaydayPlan(ctx);
  const expectedPay = saved ? Number(saved.expected_pay) : paycheck;
  const cash = totalCash(ctx);
  const buffer = saved ? Number(saved.buffer) : CASH_BUFFER;
  const dueMinimums = upcomingMinimums(ctx, nextPayday(ctx));
  const lines: string[] = [];
  let running = cash + expectedPay;

  lines.push(`Cash ${money(cash)} + expected pay ${money(expectedPay)} = ${money(running)}.`);
  lines.push(`Keep buffer ${money(buffer)}.`);
  running -= buffer;

  if (dueMinimums > 0) {
    lines.push(`Reserve ${money(dueMinimums)} for overdue or upcoming card minimums.`);
    running -= dueMinimums;
  }

  const order = priorityOrder(ctx).filter((debt) => debt.kind !== "car_loan");
  const target = order[0];
  const extraTarget = saved ? Number(saved.extra_debt_payment || 0) : Math.min(CC_TARGET, Math.max(0, running));
  const extra = Math.min(Math.max(0, running), extraTarget);
  if (target && extra > 0) {
    lines.push(`Send ${money(extra)} extra to ${target.name} (${Number(target.apr).toFixed(2)}% APR).`);
    running -= extra;
  }

  if (saved && Number(saved.spending_allowance) > 0) {
    lines.push(`Saved spending allowance: ${money(saved.spending_allowance)}.`);
    running -= Number(saved.spending_allowance);
  }

  lines.push(`Projected cash remaining: ${money(running + buffer)}.`);
  lines.push("Next action: open Payday Planner and confirm every line before paying.");
  return lines;
}

function budgetProgress(ctx: CoachContext) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return ctx.budget
    .filter((item) => item.kind !== "transfer" && item.kind !== "income")
    .map((item) => {
      const actual = ctx.transactions
        .filter(
          (transaction) =>
            transaction.category === item.name &&
            parseLocalDate(transaction.occurred_on) >= monthStart &&
            transaction.type !== "transfer",
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
      return {
        name: item.name,
        planned: Number(item.planned),
        actual,
        remaining: Number(item.planned) - actual,
      };
    });
}

function matchCategory(ctx: CoachContext, raw: string) {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9 &]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const rows = budgetProgress(ctx);
  return (
    rows.find((row) => normalized.includes(row.name.toLowerCase())) ??
    rows.find((row) => row.name.toLowerCase().includes(normalized)) ??
    rows.find((row) => row.name.toLowerCase().split(/[ &/]+/).some((word) => word.length > 3 && normalized.includes(word))) ??
    null
  );
}

export function whereDidMoneyGo(ctx: CoachContext): string {
  const rows = budgetProgress(ctx).sort((a, b) => b.actual - a.actual).slice(0, 5);
  if (!rows.some((row) => row.actual > 0)) {
    return "No spending is logged this month. Next action: add or import your recent transactions.";
  }

  const biggestOvershoot = rows
    .filter((row) => row.planned > 0 && row.actual > row.planned)
    .sort((a, b) => b.actual - b.planned - (a.actual - a.planned))[0];
  const action = biggestOvershoot
    ? `Next action: pause ${biggestOvershoot.name} spending until its ${money(biggestOvershoot.actual - biggestOvershoot.planned)} overage is recovered.`
    : `Next action: review ${rows[0].name}, your largest category at ${money(rows[0].actual)}.`;

  return `This month's top spending:\n${rows
    .map((row) => `• ${row.name}: ${money(row.actual)}${row.planned > 0 ? ` of ${money(row.planned)}` : ""}`)
    .join("\n")}\n\n${action}`;
}

export function changesSinceLastPayday(ctx: CoachContext): string {
  const today = new Date();
  const planDates = (ctx.paydayPlans ?? [])
    .map((plan) => plan.pay_date)
    .filter((date) => startOfDay(date) <= today)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const incomeDates = ctx.transactions
    .filter((transaction) => transaction.type === "income" && startOfDay(transaction.occurred_on) <= today)
    .map((transaction) => transaction.occurred_on)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const since = planDates[0] ?? incomeDates[0];

  if (!since) {
    return "I do not have a saved payday plan or income transaction to use as a starting point. Next action: save your next payday plan or log your pay deposit.";
  }

  const transactions = ctx.transactions.filter((transaction) => parseLocalDate(transaction.occurred_on) >= parseLocalDate(since));
  const income = transactions.filter((transaction) => transaction.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = transactions.filter((transaction) => transaction.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const debtPayments = transactions.filter((transaction) => transaction.type === "debt_payment").reduce((sum, item) => sum + Number(item.amount), 0);
  const importCount = pendingImports(ctx).length;

  return [
    `Since ${dateShort(since)}:`,
    `• Income logged: ${money(income)}`,
    `• Expenses logged: ${money(expenses)}`,
    `• Debt payments logged: ${money(debtPayments)}`,
    `• Cash now: ${money(totalCash(ctx))}`,
    importCount ? `• Statement imports waiting: ${importCount}` : "• No statement imports waiting",
    `Next action: ${importCount ? "review the pending statement import before trusting the totals." : "compare these totals with your bank balance and update anything missing."}`,
  ].join("\n");
}

export function howAmIDoing(ctx: CoachContext): string {
  const rows = budgetProgress(ctx);
  const over = rows.filter((row) => row.planned > 0 && row.actual > row.planned);
  const cash = totalCash(ctx);
  const payday = nextPayday(ctx);
  const minimums = upcomingMinimums(ctx, payday);
  const parts = [
    `Cash: ${money(cash)} ${cash < CASH_BUFFER ? `— below the ${money(CASH_BUFFER)} buffer.` : `— buffer protected.`}`,
    `High-interest debt: ${money(highInterestDebt(ctx))}.`,
    `Card minimums due before ${payday ? dateShort(payday) : "the next two weeks"}: ${money(minimums)}.`,
  ];

  if (over.length) parts.push(`Over budget: ${over.map((item) => `${item.name} (+${money(item.actual - item.planned)})`).join(", ")}.`);
  else parts.push("No tracked category is over budget.");

  const imports = pendingImports(ctx).length;
  if (imports) parts.push(`${imports} statement import${imports === 1 ? " is" : "s are"} waiting for review.`);
  parts.push(`Next action: ${todayAction(ctx).replace(/^.*Next action:\s*/i, "")}`);
  return parts.join("\n");
}

export function canIAfford(ctx: CoachContext, amount: number, categoryRaw?: string): string {
  if (!amount || amount <= 0) return 'Tell me the amount and category, for example: "Can I afford $80 for dining?"';
  if (!categoryRaw?.trim()) return 'I need the category too, for example: "Can I afford $80 for dining?"';

  const category = matchCategory(ctx, categoryRaw);
  if (!category) {
    const available = budgetProgress(ctx).map((row) => row.name).slice(0, 8).join(", ");
    return `I could not match “${categoryRaw.trim()}” to a budget category. Available categories include ${available || "none yet"}. Next action: choose a category or add it to your budget.`;
  }

  const cash = totalCash(ctx);
  const payday = nextPayday(ctx);
  const minimums = upcomingMinimums(ctx, payday);
  const plan = activePaydayPlan(ctx);
  const plannedExtraDebt = plan ? Number(plan.extra_debt_payment || 0) : 0;
  const protectedCash = CASH_BUFFER + minimums + plannedExtraDebt;
  const cashAfter = cash - amount;
  const categoryAfter = category.remaining - amount;
  const affordable = cashAfter >= protectedCash && categoryAfter >= 0;

  const lines = [
    `Purchase: ${money(amount)} in ${category.name}.`,
    `Cash after purchase: ${money(cashAfter)}.`,
    `Protected amount: ${money(protectedCash)} = ${money(CASH_BUFFER)} buffer + ${money(minimums)} upcoming minimums${plannedExtraDebt ? ` + ${money(plannedExtraDebt)} saved extra debt payment` : ""}.`,
    `${category.name} remaining after purchase: ${money(categoryAfter)}.`,
  ];

  if (!affordable) {
    const shortage = Math.max(0, protectedCash - cashAfter);
    if (shortage > 0) lines.push(`This would leave you ${money(shortage)} short of protected cash.`);
    if (categoryAfter < 0) lines.push(`This would put the category ${money(-categoryAfter)} over budget.`);
    lines.push("Next action: skip it or reduce the amount until both protected cash and the category budget stay positive.");
  } else {
    lines.push(`Next action: it fits your current plan; pay with available cash and log it immediately.`);
  }

  return lines.join("\n");
}

export function nextToPay(ctx: CoachContext): string {
  const order = priorityOrder(ctx).filter((debt) => debt.kind !== "car_loan");
  if (!order.length) return "No high-interest balance is active. Next action: direct surplus to your emergency fund.";
  const debt = order[0];
  const balance = Number(debt.balance) + Number(debt.pending || 0);

  if (debt.status === "past_due") {
    return `Pay ${debt.name} first because it is past due. Minimum ${money(debt.minimum_payment)}, balance ${money(balance)}. Next action: schedule at least the minimum now.`;
  }

  return `Pay ${debt.name} next because its APR is ${Number(debt.apr).toFixed(2)}%, the highest active rate. Balance ${money(balance)}, minimum ${money(debt.minimum_payment)}. Cash above your ${money(CASH_BUFFER)} buffer is ${money(availableAboveBuffer(ctx))}. Next action: confirm all minimums, then send available extra money to ${debt.name}.`;
}

export function coachAnswer(prompt: string, ctx: CoachContext): string {
  const normalized = prompt.toLowerCase().trim();
  if (!normalized) return "Ask a money question or choose a quick prompt. Next action: start with what you need to decide today.";

  if (/changed.*(payday|pay day)|since.*(payday|pay day)|last payday/.test(normalized)) return changesSinceLastPayday(ctx);
  if (/what.*today|do today|today.*action/.test(normalized)) return todayAction(ctx);
  if (/pay.*(next|first)|what.*pay|which.*debt/.test(normalized)) return nextToPay(ctx);

  if (/afford/.test(normalized)) {
    const amountMatch = normalized.match(/\$?([\d,]+(?:\.\d+)?)/);
    if (!amountMatch) return 'Tell me the amount and category, for example: "Can I afford $80 for dining?"';
    const amount = Number(amountMatch[1].replace(/,/g, ""));
    const category = normalized
      .replace(amountMatch[0], " ")
      .replace(/can i afford|could i afford|for|on|a purchase|this|\$/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return canIAfford(ctx, amount, category || undefined);
  }

  if (/where.*money|spend|went/.test(normalized)) return whereDidMoneyGo(ctx);
  if (/payday|payment.*day|paycheck/.test(normalized)) return paydayPlan(ctx).join("\n");
  if (/how.*doing|month|status|financial health/.test(normalized)) return howAmIDoing(ctx);
  if (/buffer|cash/.test(normalized)) {
    return `Cash buffer target: ${money(CASH_BUFFER)}. Current cash: ${money(totalCash(ctx))}. Available above buffer: ${money(availableAboveBuffer(ctx))}. Next action: do not spend the buffer while high-interest debt is active.`;
  }
  if (/rrsp|dpsp|retire/.test(normalized)) {
    return `Workplace retirement: ${money(totalRetirement(ctx))}. Keep the matched contribution running because the employer match is part of your compensation. Next action: do not add unmatched RRSP money until high-interest cards are cleared.`;
  }
  if (/statement|import/.test(normalized)) {
    const imports = pendingImports(ctx);
    return imports.length
      ? `${imports.length} statement import${imports.length === 1 ? " is" : "s are"} waiting for review. Nothing changes balances until you approve it. Next action: open Statement Uploads and review low-confidence or duplicate items first.`
      : "No statement import is waiting. Next action: upload your newest statement when available.";
  }

  return todayAction(ctx);
}

export const QUICK_PROMPTS = [
  "What should I do today?",
  "What should I pay next?",
  "Can I afford $80 for dining?",
  "What changed since last payday?",
  "Where did my money go?",
  "What should I do on payday?",
  "How am I doing this month?",
];
