import { describe, expect, it } from "bun:test";
import { snapshotsBeyondRetention } from "./retention.ts";

const snap = (name: string, capturedAt: number) => ({ name, capturedAt });

describe("snapshotsBeyondRetention", () => {
  it("keeps everything when retention is off or not exceeded", () => {
    expect(snapshotsBeyondRetention([snap("a", 1), snap("b", 2)], null)).toEqual([]);
    expect(snapshotsBeyondRetention([snap("a", 1), snap("b", 2)], 2)).toEqual([]);
  });

  it("returns the oldest snapshots past the newest N, whatever the input order", () => {
    expect(snapshotsBeyondRetention([snap("old", 1), snap("new", 3), snap("mid", 2)], 1)).toEqual(["mid", "old"]);
  });

  it("breaks capture-time ties by name so the result is stable", () => {
    expect(snapshotsBeyondRetention([snap("a-1", 5), snap("a-2", 5)], 1)).toEqual(["a-1"]);
  });
});
