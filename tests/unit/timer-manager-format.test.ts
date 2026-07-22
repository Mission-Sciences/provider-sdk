import { describe, it, expect } from "vitest";
import { TimerManager } from "../../src/core/TimerManager";

/**
 * GW-8183: getFormattedTimeWithHours must always render H:MM:SS, including when
 * fewer than 60 minutes remain. It previously fell back to the M:SS formatter
 * when hours === 0, so a 59:13 session rendered "59:13" instead of "0:59:13",
 * failing the sdk-integration E2E gate's /^\d+:\d{2}:\d{2}/ assertion.
 */
describe("TimerManager formatting", () => {
  describe("getFormattedTime (MM:SS)", () => {
    it("formats sub-hour durations as M:SS", () => {
      const timer = new TimerManager(59 * 60 + 13);
      expect(timer.getFormattedTime()).toBe("59:13");
    });
  });

  describe("getFormattedTimeWithHours (H:MM:SS)", () => {
    it("includes a zero hours component when under one hour remains", () => {
      const timer = new TimerManager(59 * 60 + 13);
      expect(timer.getFormattedTimeWithHours()).toBe("0:59:13");
      expect(timer.getFormattedTimeWithHours()).toMatch(/^\d+:\d{2}:\d{2}$/);
    });

    it("renders hours when at least one hour remains", () => {
      const timer = new TimerManager(2 * 3600 + 5 * 60 + 9);
      expect(timer.getFormattedTimeWithHours()).toBe("2:05:09");
    });

    it("pads minutes and seconds to two digits", () => {
      const timer = new TimerManager(3600 + 60 + 1);
      expect(timer.getFormattedTimeWithHours()).toBe("1:01:01");
    });

    it("formats zero remaining as 0:00:00", () => {
      const timer = new TimerManager(0);
      expect(timer.getFormattedTimeWithHours()).toBe("0:00:00");
    });
  });
});
