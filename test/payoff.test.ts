import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { cardDebts, minimumsTotal, simulate } from "@/lib/payoff";
import { formatMonthSpan, payoffImpact, payoffOutlook } from "@/lib/payoff-outlook";
import type { Debt } from "@/lib/types";

/**
 * The payoff projection is the number the whole app steers by — it is shown
 * on the dashboard, the debt tracker and the simulator, and it drives the
 * "what if I paid more" comparison. These pin its behaviour.
 */

function debt(
  name: string,
  balance: number,
  apr: number,
  minimum: number,
  extra: Partial<Debt> = {},
): Debt {
  return {
    id: name,
    user_id: "u",
    name,
    kind: "credit_card",
    balance,
    pending: 0,
    apr,
    credit_limit: 0,
    minimum_payment: minimum,
    minimum_estimated: false,
    due_date: null,
    status: "active",
    priority: 1,
    notes: null,
    ...extra,
  } as Debt;
}

/** The seeded debts from the README. */
const SEEDED = [
  debt("PC Mastercard", 1470.17, 26.99, 33.88, { credit_limit: 1500 }),
  debt("RBC Visa", 2530.7, 25.99, 132, { credit_limit: 2500 }),
  debt("Scene+ Visa", 2928.79, 21.99, 75.75, { credit_limit: 3000 }),
  debt("Passport Visa", 1609.02, 20.99, 50, { credit_limit: 7500 }),
  debt("Affirm", 254.26, 0, 84.75, { kind: "bnpl" }),
];

describe("cardDebts", () => {
  test("excludes the car loan from the payoff plan", () => {
    // The car loan is 3.99% and should never compete with 26.99% cards.
    const withCar = [...SEEDED, debt("Car loan", 24194.9, 3.99, 313.27, { kind: "car_loan" })];
    assert.equal(cardDebts(withCar).length, SEEDED.length);
  });

  test("excludes cleared debts", () => {
    const withCleared = [...SEEDED, debt("Afterpay", 0, 0, 0, { status: "cleared" })];
    assert.equal(cardDebts(withCleared).length, SEEDED.length);
  });

  test("includes pending charges in the balance", () => {
    const pending = [debt("Card", 100, 20, 10, { pending: 50 })];
    assert.equal(payoffOutlook(pending, 500).totalBalance, 150);
  });
});

describe("minimumsTotal", () => {
  test("sums the minimums of active card debts", () => {
    assert.equal(Number(minimumsTotal(SEEDED).toFixed(2)), 376.38);
  });
});

describe("simulate", () => {
  test("clears the debt and reports a payoff month", () => {
    const result = simulate(SEEDED, 1800, "avalanche");
    assert.ok(result.debtFreeMonth, "expected a debt-free month");
    assert.ok(result.months.length > 0);
    assert.equal(result.feasible, true);
  });

  test("avalanche clears the highest APR first", () => {
    const result = simulate(SEEDED, 1800, "avalanche");
    const cleared = result.order.filter((d) => d.clearedMonth).map((d) => d.name);
    assert.equal(cleared[0], "PC Mastercard", "26.99% should go first");
  });

  test("snowball clears the smallest balance first", () => {
    const result = simulate(SEEDED, 1800, "snowball");
    const cleared = result.order.filter((d) => d.clearedMonth).map((d) => d.name);
    assert.equal(cleared[0], "Affirm", "$254 is the smallest balance");
  });

  test("paying more costs less interest", () => {
    const slow = simulate(SEEDED, 600, "avalanche");
    const fast = simulate(SEEDED, 1800, "avalanche");
    assert.ok(fast.totalInterest < slow.totalInterest);
    assert.ok(fast.months.length < slow.months.length);
  });

  test("a payment below the minimums is not feasible", () => {
    assert.equal(simulate(SEEDED, 100, "avalanche").feasible, false);
  });
});

describe("payoffOutlook", () => {
  test("reports no debt when there is none", () => {
    const outlook = payoffOutlook([], 1800);
    assert.equal(outlook.hasDebt, false);
    assert.equal(outlook.debtFreeMonth, null);
    assert.equal(outlook.totalBalance, 0);
  });

  test("totals the seeded balances", () => {
    assert.equal(Number(payoffOutlook(SEEDED, 1800).totalBalance.toFixed(2)), 8792.94);
  });

  test("the payoff date is in the future", () => {
    const outlook = payoffOutlook(SEEDED, 1800);
    assert.ok(outlook.debtFreeDate instanceof Date);
    assert.ok(outlook.debtFreeDate!.getTime() > Date.now());
  });

  test("months remaining matches the simulated length", () => {
    const outlook = payoffOutlook(SEEDED, 1800);
    assert.equal(outlook.monthsRemaining, simulate(SEEDED, 1800, "avalanche").months.length);
  });
});

describe("payoffImpact", () => {
  test("paying more never reports a worse outcome", () => {
    const impact = payoffImpact(SEEDED, 1800, 500);
    assert.ok(impact.monthsSaved >= 0);
    assert.ok(impact.interestSaved >= 0);
  });

  test("a larger boost saves at least as much", () => {
    const small = payoffImpact(SEEDED, 600, 100);
    const large = payoffImpact(SEEDED, 600, 500);
    assert.ok(large.interestSaved >= small.interestSaved);
    assert.ok(large.monthsSaved >= small.monthsSaved);
  });

  test("adding nothing changes nothing", () => {
    const impact = payoffImpact(SEEDED, 1800, 0);
    assert.equal(impact.monthsSaved, 0);
    assert.equal(Number(impact.interestSaved.toFixed(2)), 0);
  });
});

describe("formatMonthSpan", () => {
  test("reads as years and months", () => {
    assert.equal(formatMonthSpan(6), "6 mo");
    assert.equal(formatMonthSpan(12), "1 yr");
    assert.equal(formatMonthSpan(16), "1 yr 4 mo");
  });

  test("handles the empty case", () => {
    assert.equal(formatMonthSpan(null), "—");
    assert.equal(formatMonthSpan(0), "Now");
  });
});
