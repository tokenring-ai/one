import { describe, expect, test } from "bun:test";
import {
  addDays,
  addOneHour,
  eventDurationHours,
  eventRangeToIso,
  isValidDateKey,
  layoutOverlappingEvents,
  parseTime,
  startOfWeek,
  timeToMinutes,
  toDateKey,
  toUtcDateKey,
} from "./dateUtils.ts";

describe("dateUtils", () => {
  test("toDateKey formats local date", () => {
    expect(toDateKey(new Date(2026, 2, 9))).toBe("2026-03-09");
  });

  test("toUtcDateKey formats UTC date", () => {
    // 2026-03-10T00:00:00.000Z — local western TZ would be previous evening
    const utcMidnight = new Date("2026-03-10T00:00:00.000Z");
    expect(toUtcDateKey(utcMidnight)).toBe("2026-03-10");
  });

  test("addDays and startOfWeek", () => {
    const wed = new Date(2026, 2, 11); // Wednesday
    const weekStart = startOfWeek(wed);
    expect(weekStart.getDay()).toBe(0);
    expect(weekStart.getHours()).toBe(0);
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

  test("isValidDateKey", () => {
    expect(isValidDateKey("2026-03-10")).toBe(true);
    expect(isValidDateKey("")).toBe(false);
    expect(isValidDateKey("2026-02-31")).toBe(false);
    expect(isValidDateKey(undefined)).toBe(false);
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

  test("eventRangeToIso all-day uses UTC midnight of calendar date", () => {
    const { startAt, endAt } = eventRangeToIso({ date: "2026-03-10", allDay: true });
    expect(startAt).toBe("2026-03-10T00:00:00.000Z");
    expect(endAt).toBe("2026-03-11T00:00:00.000Z");
    // Provider date-only conversion (toISOString().slice(0,10)) keeps the day
    expect(new Date(startAt).toISOString().slice(0, 10)).toBe("2026-03-10");
  });

  test("eventRangeToIso defaults end to +1h", () => {
    const { startAt, endAt } = eventRangeToIso({
      date: "2026-03-10",
      startTime: "09:00",
    });
    expect(new Date(endAt).getTime() - new Date(startAt).getTime()).toBe(60 * 60 * 1000);
  });

  test("eventRangeToIso overnight end spans to next day", () => {
    const { startAt, endAt } = eventRangeToIso({
      date: "2026-03-10",
      startTime: "22:00",
      endTime: "01:00",
    });
    const start = new Date(startAt);
    const end = new Date(endAt);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(end.getDate()).toBe(start.getDate() + 1);
    expect(end.getHours()).toBe(1);
  });

  test("eventRangeToIso rejects invalid date", () => {
    expect(() => eventRangeToIso({ date: "", allDay: true })).toThrow();
  });

  test("eventDurationHours handles overnight", () => {
    expect(eventDurationHours("09:00", "10:30")).toBe(1.5);
    expect(eventDurationHours("22:00", "01:00")).toBe(2); // until midnight
    expect(eventDurationHours("09:00")).toBe(1);
  });

  test("timeToMinutes", () => {
    expect(timeToMinutes("09:30")).toBe(9 * 60 + 30);
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("bad")).toBe(0);
  });

  test("layoutOverlappingEvents places non-overlapping events in one column", () => {
    const layout = layoutOverlappingEvents([
      { id: "a", startTime: "09:00", endTime: "10:00" },
      { id: "b", startTime: "10:00", endTime: "11:00" },
    ]);
    expect(layout.get("a")).toEqual({ col: 0, totalCols: 1 });
    expect(layout.get("b")).toEqual({ col: 0, totalCols: 1 });
  });

  test("layoutOverlappingEvents stacks concurrent events side-by-side", () => {
    const layout = layoutOverlappingEvents([
      { id: "a", startTime: "09:00", endTime: "10:00" },
      { id: "b", startTime: "09:30", endTime: "10:30" },
    ]);
    expect(layout.get("a")?.totalCols).toBe(2);
    expect(layout.get("b")?.totalCols).toBe(2);
    expect(layout.get("a")?.col).not.toBe(layout.get("b")?.col);
  });

  test("layoutOverlappingEvents reuses columns after an event ends", () => {
    const layout = layoutOverlappingEvents([
      { id: "a", startTime: "09:00", endTime: "10:00" },
      { id: "b", startTime: "09:00", endTime: "09:30" },
      { id: "c", startTime: "09:30", endTime: "10:00" },
    ]);
    // a and b overlap → 2 cols; c starts when b ends so can reuse b's column
    expect(layout.get("a")?.totalCols).toBe(2);
    expect(layout.get("c")?.totalCols).toBe(2);
    expect(layout.get("c")?.col).toBe(layout.get("b")?.col);
  });

  test("layoutOverlappingEvents ignores events without startTime", () => {
    const layout = layoutOverlappingEvents([{ id: "allday" }, { id: "timed", startTime: "12:00", endTime: "13:00" }]);
    expect(layout.has("allday")).toBe(false);
    expect(layout.get("timed")).toEqual({ col: 0, totalCols: 1 });
  });
});
