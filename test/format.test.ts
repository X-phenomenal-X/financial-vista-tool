import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  dateShort,
  daysUntil,
  groupByDate,
  money,
  parseLocalDate,
  startOfDay,
  toDateKey,
} from "@/lib/format";

/**
 * Regression tests for the timezone bugs.
 *
 * Postgres `date` columns arrive as "2026-08-04", and `new Date()` parses
 * that as UTC midnight — 8pm the previous day in America/Toronto, the
 * timezone this app is built around. Every assertion below failed before
 * the fix. Run with TZ=America/Toronto (see `npm test`); several are
 * meaningless in UTC.
 */

describe("parseLocalDate", () => {
  test("reads a date-only column as local midnight, not UTC", () => {
    const parsed = parseLocalDate("2026-08-04");
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 7, "August");
    assert.equal(parsed.getDate(), 4, "must stay the 4th, not slip to the 3rd");
    assert.equal(parsed.getHours(), 0);
  });

  test("leaves a full timestamp alone", () => {
    // Already unambiguous, so it must not be reinterpreted.
    const parsed = parseLocalDate("2026-08-04T15:30:00Z");
    assert.equal(parsed.getTime(), new Date("2026-08-04T15:30:00Z").getTime());
  });

  test("passes a Date through untouched", () => {
    const original = new Date(2026, 7, 4);
    assert.equal(parseLocalDate(original).getTime(), original.getTime());
  });
});

describe("dateShort", () => {
  test("renders the stored day, not the day before", () => {
    assert.equal(dateShort("2026-08-04"), "Aug 4");
    assert.equal(dateShort("2026-08-14"), "Aug 14");
  });

  test("does not slip across a month boundary", () => {
    // The 1st is the case that fell into the previous month.
    assert.equal(dateShort("2026-08-01"), "Aug 1");
    assert.equal(dateShort("2026-01-01"), "Jan 1");
  });
});

describe("daysUntil", () => {
  test("counts calendar days, so today is 0", () => {
    assert.equal(daysUntil(toDateKey(new Date())), 0);
  });

  test("tomorrow is 1 regardless of the time of day", () => {
    // This returned 0 in the evening before the fix, because it compared
    // elapsed milliseconds rather than day boundaries.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    assert.equal(daysUntil(toDateKey(tomorrow)), 1);
  });

  test("yesterday is -1", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    assert.equal(daysUntil(toDateKey(yesterday)), -1);
  });
});

describe("toDateKey", () => {
  test("uses the local date, not the UTC date", () => {
    // 9pm in Toronto is already tomorrow in UTC; the key must not roll over.
    const evening = new Date(2026, 7, 3, 21, 0, 0);
    assert.equal(toDateKey(evening), "2026-08-03");
  });

  test("round-trips with parseLocalDate", () => {
    assert.equal(toDateKey(parseLocalDate("2026-08-04")), "2026-08-04");
  });
});

describe("startOfDay", () => {
  test("keeps the calendar day of a date-only value", () => {
    assert.equal(startOfDay("2026-08-04").getDate(), 4);
  });
});

describe("groupByDate", () => {
  test("labels today and yesterday correctly", () => {
    const today = toDateKey(new Date());
    const yesterday = toDateKey(new Date(Date.now() - 86400000));
    const groups = groupByDate([{ occurred_on: today }, { occurred_on: yesterday }]);

    assert.equal(groups.find((g) => g.key === today)?.label, "Today");
    assert.equal(groups.find((g) => g.key === yesterday)?.label, "Yesterday");
  });
});

describe("money", () => {
  test("formats CAD with cents by default", () => {
    assert.equal(money(1234.5), "$1,234.50");
  });

  test("whole drops the cents", () => {
    assert.equal(money(1800, { whole: true }), "$1,800");
  });

  test("negatives use a minus sign rather than brackets", () => {
    assert.ok(money(-42).startsWith("−"));
  });

  test("handles null and undefined as zero", () => {
    assert.equal(money(null), "$0.00");
    assert.equal(money(undefined), "$0.00");
  });
});
