import { useState, useCallback, useEffect } from "react";
import { MarketplaceSDK } from "../core/MarketplaceSDK";
import type {
  ApplicationItem,
  PurchaseResult,
  PurchaseError,
  PrivyRequiredError,
} from "../types/purchases";

/**
 * Result returned by the usePurchaseButton hook.
 */
export interface UsePurchaseButtonResult {
  /** The marketplace item for the given itemId, or undefined if not loaded */
  item: ApplicationItem | undefined;
  /** Current token balance, or null if not loaded */
  balance: number | null;
  /**
   * Whether the purchase can proceed (item exists, is active, balance is
   * sufficient, and no Privy gate blocks it).
   */
  canPurchase: boolean;
  /** Whether the user has insufficient funds to complete the purchase */
  insufficientFunds: boolean;
  /**
   * Whether the item requires Privy verification that the user has not yet
   * completed.  When true, show a Privy upgrade prompt rather than a
   * generic error.
   */
  privyRequired: boolean;
  /** Execute the purchase for the configured item */
  purchase: () => Promise<PurchaseResult>;
  /** Whether a purchase is currently in flight */
  isPurchasing: boolean;
  /** Any error from the last purchase attempt, or null */
  error: PurchaseError | null;
  /**
   * Privy-specific error detail when the last purchase failed due to an
   * insufficient Privy level.  Null in all other cases.
   */
  privyError: PrivyRequiredError | null;
}

/**
 * Headless hook for driving a purchase button for a specific item.
 *
 * Fetches the item and current balance, derives canPurchase / insufficientFunds
 * / privyRequired, and exposes a zero-argument purchase() function bound to
 * the given itemId.
 *
 * @param itemId   - ID of the marketplace item to purchase.
 * @param quantity - Number of units to purchase (default: 1).
 *
 * @example
 * ```tsx
 * function BuyButton({ itemId }: { itemId: string }) {
 *   const {
 *     item, canPurchase, insufficientFunds, privyRequired,
 *     purchase, isPurchasing, error, privyError,
 *   } = usePurchaseButton(itemId);
 *
 *   return (
 *     <>
 *       <button disabled={!canPurchase || isPurchasing} onClick={purchase}>
 *         {isPurchasing ? 'Purchasing\u2026' : `Buy ${item?.name ?? itemId}`}
 *       </button>
 *       {insufficientFunds && <p>Not enough tokens</p>}
 *       {privyRequired && <p>Privy {privyError?.requiredLevel} required</p>}
 *       {error && !privyRequired && <p>{error.message}</p>}
 *     </>
 *   );
 * }
 * ```
 */
export function usePurchaseButton(
  itemId: string,
  quantity = 1,
): UsePurchaseButtonResult {
  const [item, setItem] = useState<ApplicationItem | undefined>(undefined);
  const [balance, setBalance] = useState<number | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<PurchaseError | null>(null);
  const [privyError, setPrivyError] = useState<PrivyRequiredError | null>(null);

  // Fetch item and balance on mount (and when itemId changes).
  useEffect(() => {
    let cancelled = false;
    try {
      const sdk = MarketplaceSDK.getInstance();
      sdk
        .getItems()
        .then((items) => {
          if (!cancelled) setItem(items.find((i) => i.id === itemId));
        })
        .catch(() => undefined);
      sdk
        .getTokenBalance()
        .then((b) => {
          if (!cancelled) setBalance(b.balance);
        })
        .catch(() => undefined);
    } catch {
      // SDK not yet initialized — state stays as defaults.
    }
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const insufficientFunds =
    balance !== null && item !== undefined
      ? balance < item.userTokenCost * quantity
      : false;

  const canPurchase =
    item !== undefined &&
    item.status === "active" &&
    balance !== null &&
    balance >= item.userTokenCost * quantity;

  const privyRequired =
    error !== null && error.code === "insufficient_privy_level";

  const purchase = useCallback(async (): Promise<PurchaseResult> => {
    setIsPurchasing(true);
    setError(null);
    setPrivyError(null);
    try {
      const sdk = MarketplaceSDK.getInstance();
      const result = await sdk.purchase({
        itemId,
        quantity,
        idempotencyKey: crypto.randomUUID(),
        expectedUnitPrice: item?.userTokenCost ?? 0,
      });
      // Refresh balance after purchase.
      sdk
        .getTokenBalance()
        .then((b) => setBalance(b.balance))
        .catch(() => undefined);
      return result;
    } catch (err) {
      const purchaseError: PurchaseError =
        err !== null &&
        typeof err === "object" &&
        "code" in err &&
        "message" in err
          ? (err as PurchaseError)
          : {
              code: "validation_failed",
              message: err instanceof Error ? err.message : String(err),
              itemId: itemId,
            };

      // Surface structured Privy error when the API returns insufficient_privy_level.
      if (purchaseError.code === "insufficient_privy_level") {
        const raw = err as Record<string, unknown>;
        setPrivyError({
          code: "insufficient_privy_level",
          message: purchaseError.message,
          currentLevel:
            typeof raw["currentLevel"] === "number" ? raw["currentLevel"] : 0,
          requiredLevel:
            typeof raw["requiredLevel"] === "number" ? raw["requiredLevel"] : 1,
        });
      }

      setError(purchaseError);
      throw purchaseError;
    } finally {
      setIsPurchasing(false);
    }
  }, [itemId, quantity, item]);

  return {
    item,
    balance,
    canPurchase,
    insufficientFunds,
    privyRequired,
    purchase,
    isPurchasing,
    error,
    privyError,
  };
}
