import type { Debt, Reminder, BudgetCategory, Transaction } from "./types";
import { daysUntil, money, dateShort } from "./format";
import { utilization } from "./coach";

export interface RuleAlert {
  id: string;
  title: string;
  body: string;
  tone: "danger" | "warning" | "info";
  rule: string;
}

export function ruleAlerts(args: {
  debts: Debt[];
  reminders: Reminder[];
  budget: BudgetCategory[];
  transactions: Transaction[];
}): RuleAlert[] {
  const out: RuleAlert[] = [];
  const now = Date.now();

  for (const d of args.debts) {
    if (d.status === "cleared") continue;
    if (d.status === "past_due") {
      out.push({ id: `overdue-${d.id}`, rule: "overdue", title: `${d.name} is overdue`, body: `Pay at least the ${money(d.minimum_payment)} minimum today to stop further fees.`, tone: "danger" });
    }
    if (d.due_date) {
      const days = daysUntil(d.due_date);
      if (days >= 0 && days <= 7) {
        out.push({ id: `due-${d.id}`, rule: "due_date", title: `${d.name} due ${dateShort(d.due_date)}`, body: `Minimum ${money(d.minimum_payment)}${d.minimum_estimated ? " (estimated)" : ""} due in ${days} day${days === 1 ? "" : "s"}.`, tone: days <= 2 ? "danger" : "warning" });
      }
    }
    if (Number(d.pending || 0) > 0) {
      out.push({ id: `pending-${d.id}`, rule: "pending", title: `${d.name} has a pending amount`, body: `${money(d.pending)} is still pending — confirm it posts before you plan around it.`, tone: "info" });
    }
    const u = utilization(d);
    if (u >= 1) out.push({ id: `over-${d.id}`, rule: "over_limit", title: `${d.name} is over its limit`, body: `${(u * 100).toFixed(0)}% of ${money(d.credit_limit)} — bring it under the limit to avoid over-limit fees.`, tone: "danger" });
    else if (u >= 0.8) out.push({ id: `util-${d.id}`, rule: "utilization", title: `${d.name} above 80% utilization`, body: `${(u * 100).toFixed(0)}% used. Paying it down protects your credit score.`, tone: "warning" });
  }

  const payday = args.reminders.find((r) => r.kind === "payday" && !r.completed);
  if (payday) {
    const days = daysUntil(payday.due_at);
    if (days >= 0 && days <= 3) out.push({ id: `payday-${payday.id}`, rule: "payday", title: "Payday is close", body: `${payday.title} — ${dateShort(payday.due_at)}. Run the payday planner before the money lands.`, tone: "info" });
  }

  const day = new Date().getDate();
  const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  if (day >= lastDay - 2) out.push({ id: "budget-review", rule: "budget_review", title: "Monthly budget review", body: "The month is nearly over — check planned vs actual and reset next month's limits.", tone: "info" });

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  for (const b of args.budget) {
    if (b.kind === "transfer" || b.kind === "income" || Number(b.planned) <= 0) continue;
    const spent = args.transactions.filter((t) => t.category === b.name && t.type === "expense" && new Date(t.occurred_on) >= monthStart).reduce((s, t) => s + Number(t.amount), 0);
    if (spent > Number(b.planned)) out.push({ id: `budget-${b.id}`, rule: "over_budget", title: `${b.name} over budget`, body: `${money(spent)} spent of ${money(b.planned)} — over by ${money(spent - Number(b.planned))}.`, tone: "warning" });
  }

  for (const r of args.reminders) {
    if (r.completed || r.paused) continue;
    if (r.snoozed_until && new Date(r.snoozed_until).getTime() > now) continue;
    const due = new Date(r.due_at).getTime();
    if (due <= now) out.push({ id: `rem-${r.id}`, rule: "reminder", title: r.title, body: r.notes ?? `Due ${dateShort(r.due_at)}.`, tone: "warning" });
  }

  return out;
}

export function advanceRecurrence(dueAt: string, recurrence: string): string | null {
  const d = new Date(dueAt);
  switch (recurrence) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    default: return null;
  }
  return d.toISOString();
}
