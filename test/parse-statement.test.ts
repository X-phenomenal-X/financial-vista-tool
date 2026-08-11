import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseDate, findDuplicate } from "@/lib/parse-statement";

/**
 * Statement parsing is the riskiest surface in the app: regexes over text
 * from a dozen bank formats, feeding a flow that writes balances. A wrong
 * result here is silent — it looks like a perfectly ordinary transaction.
 *
 * Bank sync files into the same review queue, so these guarantees now cover
 * that path too.
 */

describe("parseDate", () => {
  test("reads ISO", () => {
    assert.equal(parseDate("2026-08-04"), "2026-08-04");
  });

  test("reads written months in either order", () => {
    assert.equal(parseDate("Aug 4, 2026"), "2026-08-04");
    assert.equal(parseDate("August 4 2026"), "2026-08-04");
    assert.equal(parseDate("4 Aug 2026"), "2026-08-04");
    assert.equal(parseDate("4 August, 2026"), "2026-08-04");
  });

  test("treats a day over 12 as day-first", () => {
    assert.equal(parseDate("31/08/2026"), "2026-08-31");
    assert.equal(parseDate("25/12/2026"), "2026-12-25");
  });

  test("expands a two-digit year", () => {
    assert.equal(parseDate("08/04/26"), "2026-08-04");
  });

  test("falls back to the given year when the statement omits it", () => {
    assert.equal(parseDate("Aug 4", 2025), "2025-08-04");
  });

  describe("rejects impossible dates instead of rolling them over", () => {
    // Date.UTC(2026, 1, 31) silently returns Mar 3. Before the fix these
    // produced real-looking dates in the wrong month, which then landed in
    // the wrong month's budget.
    test("Feb 31", () => assert.equal(parseDate("2026-02-31"), null));
    test("Feb 30 in slash form", () => assert.equal(parseDate("02/30/2026"), null));
    test("Apr 31", () => assert.equal(parseDate("2026-04-31"), null));
    test("month 13", () => assert.equal(parseDate("2026-13-01"), null));
    test("day 0", () => assert.equal(parseDate("2026-08-00"), null));
  });

  test("accepts a real leap day and rejects a fake one", () => {
    assert.equal(parseDate("2028-02-29"), "2028-02-29", "2028 is a leap year");
    assert.equal(parseDate("2026-02-29"), null, "2026 is not");
  });

  test("matches month names on their first three letters", () => {
    // Deliberate leniency: "Sept", "August" and "Aug." must all resolve.
    assert.equal(parseDate("Sept 4, 2026"), "2026-09-04");
    assert.equal(parseDate("Aug. 4, 2026"), "2026-08-04");
  });

  test("returns null for junk rather than guessing", () => {
    for (const junk of ["", "   ", "garbage", "12", "--", "4/2026", "Not a date"]) {
      assert.equal(parseDate(junk), null, `expected null for ${JSON.stringify(junk)}`);
    }
  });
});

describe("findDuplicate", () => {
  const existing = [
    { id: "t1", occurred_on: "2026-08-04", amount: -42.5, description: "METRO GROCERY" },
  ];

  test("matches the same transaction", () => {
    const hit = findDuplicate(
      { occurred_on: "2026-08-04", amount: -42.5, description: "METRO GROCERY" },
      existing,
    );
    assert.equal(hit?.id, "t1");
  });

  test("does not match a different amount", () => {
    const hit = findDuplicate(
      { occurred_on: "2026-08-04", amount: -99, description: "METRO GROCERY" },
      existing,
    );
    assert.equal(hit, null);
  });

  test("does not match a distant date", () => {
    const hit = findDuplicate(
      { occurred_on: "2026-09-20", amount: -42.5, description: "METRO GROCERY" },
      existing,
    );
    assert.equal(hit, null);
  });

  test("finds nothing in an empty ledger", () => {
    assert.equal(
      findDuplicate({ occurred_on: "2026-08-04", amount: -42.5, description: "X" }, []),
      null,
    );
  });
});
