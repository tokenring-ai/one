import { describe, expect, test } from "bun:test";
import { rpcToLocalEvent } from "./rpcToLocalEvent.ts";

describe("rpcToLocalEvent", () => {
  test("all-day event uses UTC calendar date (not local shift)", () => {
    // Google-style all-day: date-only stored as UTC midnight
    const local = rpcToLocalEvent(
      {
        id: "e1",
        title: "Holiday",
        startAt: new Date("2026-03-10T00:00:00.000Z"),
        endAt: new Date("2026-03-11T00:00:00.000Z"),
        allDay: true,
      },
      "google",
    );
    expect(local.date).toBe("2026-03-10");
    expect(local.allDay).toBe(true);
    expect(local.startTime).toBeUndefined();
    expect(local.source).toBe("rpc");
    expect(local.provider).toBe("google");
  });

  test("timed event uses local wall-clock times", () => {
    const start = new Date(2026, 2, 10, 14, 30, 0, 0);
    const end = new Date(2026, 2, 10, 15, 0, 0, 0);
    const local = rpcToLocalEvent(
      {
        id: "e2",
        title: "Meeting",
        startAt: start,
        endAt: end,
        allDay: false,
        description: "Notes",
        location: "HQ",
      },
      "google",
    );
    expect(local.date).toBe("2026-03-10");
    expect(local.startTime).toBe("14:30");
    expect(local.endTime).toBe("15:00");
    expect(local.description).toBe("Notes");
    expect(local.location).toBe("HQ");
  });
});
