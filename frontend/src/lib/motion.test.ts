import { afterEach, describe, expect, it } from "bun:test";
import { prefersReducedMotion, scrollBehavior } from "./motion.ts";

const original = window.matchMedia;

function setReduce(reduce: boolean) {
  window.matchMedia = ((query: string) => ({ matches: reduce && query.includes("reduce"), media: query })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = original;
  delete document.documentElement.dataset.motion;
});

describe("motion helper", () => {
  it("is smooth when motion is not reduced", () => {
    setReduce(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(scrollBehavior()).toBe("smooth");
  });

  it("is auto when the OS asks for reduced motion", () => {
    setReduce(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(scrollBehavior()).toBe("auto");
  });

  it("is auto when the app sets data-motion=reduce", () => {
    setReduce(false);
    document.documentElement.dataset.motion = "reduce";
    expect(scrollBehavior()).toBe("auto");
  });

  it("does not throw when matchMedia is missing", () => {
    // @ts-expect-error simulating an environment without matchMedia
    window.matchMedia = undefined;
    expect(scrollBehavior()).toBe("smooth");
  });
});
