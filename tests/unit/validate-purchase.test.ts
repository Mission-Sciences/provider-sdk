/**
 * Unit tests for validatePurchase field mapping
 * Tests gw-sdk-api ValidatePurchaseResponse -> SDK ValidationResult
 * (Updated for GW-8195 to match deployed gw-sdk-api contract)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketplaceSDK } from "../../src/core/MarketplaceSDK";
import type { ValidationResult } from "../../src/types/purchases";

// gw-sdk-api ValidatePurchaseResponse shape (main.go:406-411)
interface SdkApiValidateResponse {
  valid: boolean;
  reason?: string;
  totalCost: number;
  remainingBalance: number;
}

function makeSDK(): MarketplaceSDK {
  return new MarketplaceSDK({
    apiEndpoint: "https://api.test.com",
    publisherToken: "test-token",
    orgId: "test-org",
  });
}

function injectSession(sdk: MarketplaceSDK): void {
  const future = Math.floor(Date.now() / 1000) + 3600;
  (sdk as any).sessionData = {
    sessionId: "test-session-id",
    applicationId: "app-001",
    userId: "user-001",
    orgId: "org-001",
    startTime: Math.floor(Date.now() / 1000),
    durationMinutes: 60,
    iat: Math.floor(Date.now() / 1000),
    exp: future,
    iss: "generalwisdom.com",
    sub: "user-001",
  };
  (sdk as any).jwtToken = "test-jwt-token";
}

describe("MarketplaceSDK.validatePurchase - field mapping", () => {
  let sdk: MarketplaceSDK;

  beforeEach(() => {
    sdk = makeSDK();
    injectSession(sdk);
  });

  it("should map valid:true backend response to canPurchase:true", async () => {
    const backendResponse: SdkApiValidateResponse = {
      valid: true,
      totalCost: 100,
      remainingBalance: 500,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => backendResponse,
    });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 1);

    expect(result.canPurchase).toBe(true);
    expect(result.itemCost).toBe(100);
    expect(result.currentBalance).toBe(500);
    expect(result.reason).toBeUndefined();
  });

  it("should map valid:false with reason to canPurchase:false with reason", async () => {
    const backendResponse: SdkApiValidateResponse = {
      valid: false,
      reason: "insufficient_balance",
      totalCost: 100,
      remainingBalance: 50,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => backendResponse,
    });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 1);

    expect(result.canPurchase).toBe(false);
    expect(result.reason).toBe("insufficient_balance");
    expect(result.itemCost).toBe(100);
    expect(result.currentBalance).toBe(50);
  });

  it("should map inactive/unavailable item to canPurchase:false", async () => {
    const backendResponse: SdkApiValidateResponse = {
      valid: false,
      reason: "item_unavailable",
      totalCost: 0,
      remainingBalance: 500,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => backendResponse,
    });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 1);

    expect(result.canPurchase).toBe(false);
    expect(result.reason).toBe("item_unavailable");
  });

  it("should ensure canPurchase is a strict boolean (never undefined)", async () => {
    const backendResponse: SdkApiValidateResponse = {
      valid: true,
      totalCost: 100,
      remainingBalance: 500,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => backendResponse,
    });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 1);

    expect(typeof result.canPurchase).toBe("boolean");
    expect(result.canPurchase).not.toBeUndefined();
  });

  it("should handle quantity > 1 correctly (totalCost reflects line total)", async () => {
    const backendResponse: SdkApiValidateResponse = {
      valid: true,
      totalCost: 300, // 3 items at 100 each
      remainingBalance: 200,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => backendResponse,
    });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 3);

    expect(result.canPurchase).toBe(true);
    expect(result.itemCost).toBe(300);
    expect(result.currentBalance).toBe(200);
  });
});
