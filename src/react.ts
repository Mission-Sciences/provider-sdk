/**
 * gw-sdk/react — React hooks for purchase integration.
 *
 * This module is the entry point for the 'gw-sdk/react' export condition.
 * It is separate from the main 'gw-sdk' package export so that:
 *   1. React is never bundled into environments that don't use hooks.
 *   2. Tree-shaking works correctly — only imported hooks are included.
 *
 * React 18+ is required as a peer dependency.
 *
 * @example
 * ```tsx
 * import { useGWBalance, useGWItems, useGWPurchase } from 'gw-sdk/react';
 * ```
 */
export { useGWBalance } from "./hooks/useGWBalance";
export type {
  UseGWBalanceOptions,
  UseGWBalanceResult,
} from "./hooks/useGWBalance";

export { useGWItems } from "./hooks/useGWItems";
export type { UseGWItemsOptions, UseGWItemsResult } from "./hooks/useGWItems";

export { useGWPurchase } from "./hooks/useGWPurchase";
export type { UseGWPurchaseResult } from "./hooks/useGWPurchase";

export { useGWStore } from "./hooks/useGWStore";
export type { UseGWStoreOptions, UseGWStoreResult } from "./hooks/useGWStore";

export { usePurchaseButton } from "./hooks/usePurchaseButton";
export type { UsePurchaseButtonResult } from "./hooks/usePurchaseButton";

export { GWPurchaseButton } from "./components/GWPurchaseButton";
export type {
  GWPurchaseButtonProps,
  GWPurchaseButtonTheme,
  GWPurchaseButtonRenderProps,
} from "./components/GWPurchaseButton";

// Re-export purchase types so consumers don't need a separate import.
export type {
  ApplicationItem,
  PurchaseRequest,
  PurchaseResult,
  ValidationResult,
  PurchaseErrorCode,
  PurchaseError,
  SessionPurchase,
  PrivyRequiredError,
  PurchaseState,
} from "./types/purchases";
export { PURCHASE_STATE } from "./types/purchases";
