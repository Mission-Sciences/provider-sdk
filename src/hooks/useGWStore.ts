import { useGWBalance, type UseGWBalanceOptions } from "./useGWBalance";
import { useGWItems, type UseGWItemsOptions } from "./useGWItems";
import { useGWPurchase } from "./useGWPurchase";
import type {
  ApplicationItem,
  PurchaseRequest,
  PurchaseResult,
  PurchaseError,
} from "../types/purchases";

/**
 * Options for the useGWStore convenience hook.
 */
export interface UseGWStoreOptions {
  /** Balance polling/refetch options */
  balance?: UseGWBalanceOptions;
  /** Items polling options */
  items?: UseGWItemsOptions;
}

/**
 * Combined result of the useGWStore hook.
 */
export interface UseGWStoreResult {
  /** Current SMART token balance, or null if not yet loaded */
  balance: number | null;
  /** Formatted balance string, e.g. "27 tokens" */
  formattedBalance: string;
  /** List of available marketplace items */
  items: ApplicationItem[];
  /** Whether any data is currently loading */
  isLoading: boolean;
  /** Any error from balance or items fetches, or null */
  error: Error | null;
  /** Execute a purchase for an item */
  purchase: (request: PurchaseRequest) => Promise<PurchaseResult>;
  /** Whether a purchase is currently in flight */
  isPurchasing: boolean;
  /**
   * Whether the user can afford to purchase the given item.
   * Returns false when balance or item cost is unknown.
   */
  canPurchase: (itemId: string, quantity?: number) => boolean;
}

/**
 * Combined convenience hook that aggregates balance, items, and purchase
 * state into a single object.
 *
 * @example
 * ```tsx
 * function StorePage() {
 *   const { balance, items, isLoading, purchase, canPurchase } = useGWStore();
 *   if (isLoading) return <p>Loading\u2026</p>;
 *   return (
 *     <ul>
 *       {items.map(item => (
 *         <li key={item.id}>
 *           {item.name} \u2014 {item.userTokenCost} tokens
 *           <button disabled={!canPurchase(item.id)} onClick={() =>
 *             purchase({ itemId: item.id, idempotencyKey: crypto.randomUUID(), expectedUnitPrice: item.userTokenCost })
 *           }>
 *             Buy
 *           </button>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useGWStore(options: UseGWStoreOptions = {}): UseGWStoreResult {
  const balanceResult = useGWBalance(options.balance);
  const itemsResult = useGWItems(options.items);
  const purchaseResult = useGWPurchase();

  const isLoading = balanceResult.isLoading || itemsResult.isLoading;
  const error: Error | null = balanceResult.error ?? itemsResult.error ?? null;

  const canPurchase = (itemId: string, quantity = 1): boolean => {
    const { balance } = balanceResult;
    if (balance === null) return false;
    const item = itemsResult.items.find((i) => i.id === itemId);
    if (!item || item.status !== "active") return false;
    return balance >= item.userTokenCost * quantity;
  };

  const purchase = async (
    request: PurchaseRequest,
  ): Promise<PurchaseResult> => {
    const { quantity = 1 } = request;
    if (!canPurchase(request.itemId, quantity)) {
      const err: PurchaseError = {
        code: "insufficient_balance",
        message: "Insufficient balance or item unavailable",
        itemId: request.itemId,
      };
      throw err;
    }
    return purchaseResult.purchase(request);
  };

  return {
    balance: balanceResult.balance,
    formattedBalance: balanceResult.formattedBalance,
    items: itemsResult.items,
    isLoading,
    error,
    purchase,
    isPurchasing: purchaseResult.isPurchasing,
    canPurchase,
  };
}
