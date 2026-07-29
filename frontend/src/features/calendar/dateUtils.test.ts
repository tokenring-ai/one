import { describe, expect, test } from "bun:test";
import { addDays, addOneHour, eventRangeToIso, parseTime, startOfWeek, toDateKey } from "./dateUtils.ts";

describe("dateUtils", () => {
  test("toDateKey formats local date", () => {
    expect(toDateKey(new Date(2026, 2, 9))).toBe("2026-03-09");
  });

  test("addDays and startOfWeek", () => {
    const wed = new Date(2026, 2, 11); // Wednesday
    expect(startOfWeek(wed).getDay()).toBe(0);
    expect(toDateKey(addDays(wed, 2))).toBe("2026-03-13");
  });

  test("parseTime", () => {
    expect(parseTime("09:30")).toEqual({ h: 9, m: 30 });
    expect(parseTime("bad")).toBeNull();
    expect(parseTime(undefined)).toBeNull();
  });

  test("addOneHour wraps within day", () => {
    expect(addOneHour("09:00")).toBe("10:00");
    expect(addOneHour("23:30")).toBe("00:30");
  });

  test("eventRangeToIso timed event", () => {
    const { startAt, endAt } = eventRangeToIso({
      date: "2026-03-10",
      allDay: false,
      startTime: "17:00",
      endTime: "17:30",
    });
    const start = new Date(startAt);
    const end = new Date(endAt);
    expect(start.getHours()).toBe(17);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(17);
    expect(end.getMinutes()).toBe(30);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  test("eventRangeToIso all-day spans full local day", () => {
    const { startAt, endAt } = eventRangeToIso({ date: "2026-03-10", allDay: true });
    const start = new Date(startAt);
    const end = new Date(endAt);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  test("eventRangeToIso defaults end to +1h", () => {
    const { startAt, endAt } = eventRangeToIso({
      date: "2026-03-10",
      startTime: "09:00",
    });
    expect(new Date(endAt).getTime() - new Date(startAt).getTime()).toBe(60 * 60 * 1000);
  });
});
