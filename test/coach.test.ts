import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { countsAsSpend, spendAmount, whereDidMoneyGo, type CoachContext } from "@/lib/coach";
import { ruleAlerts } from "@/lib/reminder-rules";
import { toDateKey } from "@/lib/format";

/**
 * Regression tests for the budget-total bugs.
 *
 * Two separate faults made every over-budget check silently dead:
 *   1. Outflows are stored negative, but totals summed raw amounts, so
 *      "actual" came out negative and could never exceed a plan.
 *   2. Four screens each decided independently what counted as spending,
 *      and one of them counted income.
 */

const today = toDateKey(new Date());

/** Mirrors quick-add: `signed = type === "income" ? amt : -amt`. */
function txn(type: string, category: string | null, amount: number) {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: "u",
    occurred_on: today,
    type,
    category,
    account_id: null,
    debt_id: null,
    description: null,
    need_want: null,
    cleared: true,
    amount: type === "income" ? amount : -amount,
  };
}

function context(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    accounts: [],
    debts: [],
    budget: [],
    transactions: [],
    reminders: [],
    goals: [],
    ...overrides,
  } as CoachContext;
}

describe("countsAsSpend", () => {
  test("expenses and debt payments count", () => {
    assert.equal(countsAsSpend({ type: "expense" }), true);
    assert.equal(countsAsSpend({ type: "debt_payment" }), true);
  });

  test("income never counts", () => {
    // A deposit tagged with an expense category used to be added to that
    // category's spend, inventing overages out of money coming in.
    assert.equal(countsAsSpend({ type: "income" }), false);
  });

  test("transfers never count", () => {
    // The full rent payment and the roommates' share move through the
    // account without being personal spending.
    assert.equal(countsAsSpend({ type: "transfer" }), false);
  });
});

describe("spendAmount", () => {
  test("returns the magnitude of a stored outflow", () => {
    assert.equal(spendAmount({ amount: -350 }), 350);
  });

  test("is positive for either sign", () => {
    assert.equal(spendAmount({ amount: 350 }), 350);
  });

  test("treats unparseable amounts as zero rather than NaN", () => {
    assert.equal(spendAmount({ amount: "not a number" as unknown as number }), 0);
  });
});

describe("whereDidMoneyGo", () => {
  const ctx = context({
    budget: [
      { id: "b1", user_id: "u", name: "Groceries", kind: "expense", planned: 350, sort_order: 1 },
      { id: "b2", user_id: "u", name: "Gas", kind: "expense", planned: 400, sort_order: 2 },
    ] as CoachContext["budget"],
    transactions: [
      txn("expense", "Groceries", 520),
      txn("expense", "Gas", 90),
    ] as CoachContext["transactions"],
  });

  test("reports spending instead of claiming there is none", () => {
    // Returned "No spending is logged this month" while $610 was logged,
    // because every actual summed to a negative number.
    const answer = whereDidMoneyGo(ctx);
    assert.ok(!answer.includes("No spending is logged"), answer);
    assert.ok(answer.includes("$520.00"), answer);
  });

  test("ranks the largest category first", () => {
    // Sorting descending over negative values put the smallest first.
    const answer = whereDidMoneyGo(ctx);
    assert.ok(answer.indexOf("Groceries") < answer.indexOf("Gas"), answer);
  });

  test("names the category that is actually over plan", () => {
    const answer = whereDidMoneyGo(ctx);
    assert.ok(answer.includes("$170.00"), `expected the $170 overage: ${answer}`);
  });

  test("does not count income as spending", () => {
    const withIncome = context({
      budget: ctx.budget,
      transactions: [
        txn("expense", "Groceries", 350),
        txn("income", "Groceries", 120),
      ] as CoachContext["transactions"],
    });
    const answer = whereDidMoneyGo(withIncome);
    assert.ok(answer.includes("$350.00"), answer);
    assert.ok(!answer.includes("$470.00"), `income was counted as spending: ${answer}`);
  });
});

describe("over-budget alerts", () => {
  test("fire when a category exceeds its plan", () => {
    // Never fired: a negative actual can't be greater than a positive plan.
    const alerts = ruleAlerts({
      debts: [],
      reminders: [],
      budget: [
        { id: "b1", user_id: "u", name: "Groceries", kind: "expense", planned: 350, sort_order: 1 },
      ] as never,
      transactions: [txn("expense", "Groceries", 520)] as never,
    });

    const over = alerts.filter((a) => a.rule === "over_budget");
    assert.equal(over.length, 1, "expected one over-budget alert");
    assert.ok(over[0].body.includes("$170.00"), over[0].body);
  });

  test("stay quiet when spending is within plan", () => {
    const alerts = ruleAlerts({
      debts: [],
      reminders: [],
      budget: [
        { id: "b1", user_id: "u", name: "Groceries", kind: "expense", planned: 350, sort_order: 1 },
      ] as never,
      transactions: [txn("expense", "Groceries", 100)] as never,
    });
    assert.equal(alerts.filter((a) => a.rule === "over_budget").length, 0);
  });
});
