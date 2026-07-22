/**
 * GW-8195 regression tests for validatePurchase against the ACTUAL gw-sdk-api contract.
 *
 * The SDK dev apiEndpoint (https://sdk.dev.generalwisdom.com/v1) is served by
 * gw-sdk-api/cmd/sdk-session-purchases (handleValidatePurchase), which returns:
 *
 *   { valid, reason, totalCost, remainingBalance }   // camelCase, no can_afford/errors[]/near_expiry
 *
 * GW-8192 mapped validatePurchase against gw-functions' ValidationResult.yaml shape
 * (valid && can_afford, errors[], current_balance/total_tokens/near_expiry), so
 * canPurchase is ALWAYS false and currentBalance/itemCost come back undefined.
 *
 * These tests mock the real gw-sdk-api response body and are EXPECTED TO FAIL until
 * GW-8195 repoints mapValidationResult to the deployed contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketplaceSDK } from "../../src/core/MarketplaceSDK";
import type { ValidationResult } from "../../src/types/purchases";

// Real gw-sdk-api ValidatePurchaseResponse shape (main.go:406-411).
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

function mockResponse(body: SdkApiValidateResponse): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe("MarketplaceSDK.validatePurchase - gw-sdk-api contract (GW-8195)", () => {
  let sdk: MarketplaceSDK;

  beforeEach(() => {
    sdk = makeSDK();
    injectSession(sdk);
  });

  it("valid, affordable item returns canPurchase:true", async () => {
    // gw-sdk-api valid path: main.go:670-674 (balance >= totalCost)
    mockResponse({ valid: true, totalCost: 100, remainingBalance: 400 });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 1);

    expect(result.canPurchase).toBe(true);
    expect(result.itemCost).toBe(100);
    expect(result.currentBalance).toBe(400);
    expect(result.reason).toBeUndefined();
  });

  it("insufficient balance returns canPurchase:false with reason", async () => {
    // gw-sdk-api insufficient path: main.go:661-667
    mockResponse({
      valid: false,
      reason: "insufficient_balance",
      totalCost: 100,
      remainingBalance: 10,
    });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 1);

    expect(result.canPurchase).toBe(false);
    expect(result.reason).toBe("insufficient_balance");
    expect(result.itemCost).toBe(100);
    expect(result.currentBalance).toBe(10);
  });

  it("unavailable item returns canPurchase:false with reason", async () => {
    // gw-sdk-api item_unavailable path: main.go:647-651 (no cost/balance fields)
    mockResponse({
      valid: false,
      reason: "item_unavailable",
      totalCost: 0,
      remainingBalance: 0,
    });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 1);

    expect(result.canPurchase).toBe(false);
    expect(result.reason).toBe("item_unavailable");
  });

  it("canPurchase is a strict boolean, never undefined", async () => {
    mockResponse({ valid: true, totalCost: 100, remainingBalance: 400 });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 1);

    expect(typeof result.canPurchase).toBe("boolean");
  });

  it("quantity > 1 reflects line total from totalCost", async () => {
    mockResponse({ valid: true, totalCost: 300, remainingBalance: 200 });

    const result: ValidationResult = await sdk.validatePurchase("test-item", 3);

    expect(result.itemCost).toBe(300);
  });
});
