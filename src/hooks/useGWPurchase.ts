import { useState, useCallback } from "react";
import { MarketplaceSDK } from "../core/MarketplaceSDK";
import type {
  PurchaseRequest,
  PurchaseResult,
  PurchaseError,
  ValidationResult,
} from "../types/purchases";

/**
 * Result returned by the useGWPurchase hook.
 */
export interface UseGWPurchaseResult {
  /**
   * Execute a purchase for an item.
   * Resolves with the purchase result or rejects with a PurchaseError.
   */
  purchase: (request: PurchaseRequest) => Promise<PurchaseResult>;
  /**
   * Validate whether a purchase is possible without committing it.
   * Resolves with a ValidationResult indicating balance sufficiency.
   */
  validate: (itemId: string, quantity?: number) => Promise<ValidationResult>;
  /** Whether a purchase is currently in flight */
  isPurchasing: boolean;
  /** The result of the most recent successful purchase, or null */
  lastPurchase: PurchaseResult | null;
  /** Any purchase-specific error from the last operation, or null */
  error: PurchaseError | null;
  /** Clear the current error state */
  clearError: () => void;
}

/** Normalise any thrown value into a PurchaseError shape. */
function toPurchaseError(err: unknown, defaultCode: string): PurchaseError {
  if (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    "message" in err
  ) {
    return err as PurchaseError;
  }
  return {
    code: defaultCode as PurchaseError["code"],
    message: err instanceof Error ? err.message : String(err),
    itemId: "unknown", // Add required itemId field
  };
}

/**
 * React hook for executing and validating marketplace purchases.
 *
 * Uses MarketplaceSDK.getInstance() to retrieve the SDK instance and
 * delegates to the purchase API. Works with React 18 concurrent features —
 * state updates are batched automatically.
 *
 * @example
 * ```tsx
 * function BuyButton({ itemId }: { itemId: string }) {
 *   const { purchase, isPurchasing, error, clearError } = useGWPurchase();
 *
 *   const handleBuy = async () => {
 *     clearError();
 *     try {
 *       const result = await purchase({ itemId, idempotencyKey: crypto.randomUUID(), expectedUnitPrice: item.userTokenCost });
 *       console.log('Purchased! Remaining:', result.remainingBalance);
 *     } catch {
 *       // error state is already set by the hook
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleBuy} disabled={isPurchasing}>
 *         {isPurchasing ? 'Purchasing\u2026' : 'Buy'}
 *       </button>
 *       {error && <p>{error.message}</p>}
 *     </>
 *   );
 * }
 * ```
 */
export function useGWPurchase(): UseGWPurchaseResult {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [lastPurchase, setLastPurchase] = useState<PurchaseResult | null>(null);
  const [error, setError] = useState<PurchaseError | null>(null);

  const purchase = useCallback(
    async (request: PurchaseRequest): Promise<PurchaseResult> => {
      setIsPurchasing(true);
      setError(null);

      try {
        const sdk = MarketplaceSDK.getInstance();
        const result = await sdk.purchase(request);
        setLastPurchase(result);
        return result;
      } catch (err) {
        const purchaseError = toPurchaseError(err, "validation_failed");
        setError(purchaseError);
        throw purchaseError;
      } finally {
        setIsPurchasing(false);
      }
    },
    [],
  );

  const validate = useCallback(
    async (itemId: string, quantity = 1): Promise<ValidationResult> => {
      try {
        const sdk = MarketplaceSDK.getInstance();
        return await sdk.validatePurchase(itemId, quantity);
      } catch (err) {
        const purchaseError = toPurchaseError(err, "validation_failed");
        setError(purchaseError);
        throw purchaseError;
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { purchase, validate, isPurchasing, lastPurchase, error, clearError };
}
