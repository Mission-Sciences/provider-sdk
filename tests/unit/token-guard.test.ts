/**
 * Unit tests for the JWT shape guard (GW-8643).
 */

import { describe, it, expect } from "vitest";
import { isLikelyJwt } from "../../src/utils/token";

describe("isLikelyJwt", () => {
  it("accepts a well-formed three-part token", () => {
    expect(isLikelyJwt("aaa.bbb.ccc")).toBe(true);
  });

  it("accepts a realistic JWT", () => {
    const jwt =
      "eyJhbGciOiJSUzI1NiIsImtpZCI6ImtleTEifQ." +
      "eyJzZXNzaW9uSWQiOiJzZXNzLTEifQ." +
      "c2lnbmF0dXJl";
    expect(isLikelyJwt(jwt)).toBe(true);
  });

  it('rejects the literal string "undefined"', () => {
    expect(isLikelyJwt("undefined")).toBe(false);
  });

  it('rejects the literal string "null"', () => {
    expect(isLikelyJwt("null")).toBe(false);
  });

  it("rejects the empty string and whitespace", () => {
    expect(isLikelyJwt("")).toBe(false);
    expect(isLikelyJwt("   ")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isLikelyJwt(null)).toBe(false);
    expect(isLikelyJwt(undefined)).toBe(false);
    expect(isLikelyJwt(42)).toBe(false);
    expect(isLikelyJwt({})).toBe(false);
  });

  it("rejects strings without exactly three parts", () => {
    expect(isLikelyJwt("aaa")).toBe(false);
    expect(isLikelyJwt("aaa.bbb")).toBe(false);
    expect(isLikelyJwt("aaa.bbb.ccc.ddd")).toBe(false);
  });

  it("rejects tokens with empty segments", () => {
    expect(isLikelyJwt("aaa..ccc")).toBe(false);
    expect(isLikelyJwt(".bbb.ccc")).toBe(false);
    expect(isLikelyJwt("aaa.bbb.")).toBe(false);
  });
});
