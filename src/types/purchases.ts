/**
 * In-Session Purchase Types for Marketplace SDK
 *
 * Types for the purchase API endpoints within an active session.
 * All purchase operations require a valid session JWT.
 *
 * Per PRP-044: In-Session Purchases
 */

/**
 * Discriminated union of all purchase error codes
 */
export type PurchaseErrorCode =
  | "insufficient_balance"
  | "price_changed"
  | "session_expired"
  | "item_not_found"
  | "item_inactive"
  | "self_purchase_blocked"
  | "duplicate_purchase"
  | "rate_limited"
  | "validation_failed"
  | "insufficient_privy_level";

/**
 * Purchase state constants.
 * Use these to handle distinct purchase outcomes in your UI.
 *
 * - INSUFFICIENT_FUNDS: user's token balance is too low
 * - PRIVY_REQUIRED: item requires Privy 1 verification; surface upgrade flow
 */
export const PURCHASE_STATE = {
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  PRIVY_REQUIRED: "PRIVY_REQUIRED",
} as const;

export type PurchaseState =
  (typeof PURCHASE_STATE)[keyof typeof PURCHASE_STATE];

/**
 * Error detail returned when a purchase is blocked by an insufficient Privy level.
 * Only `requiredLevel` is exposed to the publisher; raw eligibility data is NOT forwarded.
 */
export interface PrivyRequiredError {
  /** Always 'insufficient_privy_level' */
  code: "insufficient_privy_level";
  /** Human-readable message */
  message: string;
  /** Current Privy level of the user (e.g. 0) */
  currentLevel: number;
  /** Minimum Privy level required to purchase (e.g. 1) */
  requiredLevel: number;
}

/**
 * A purchasable item defined by a publisher for their application.
 * Items are session-scoped; they expire when the session ends.
 */
export interface ApplicationItem {
  /** Unique item identifier (UUID) */
  id: string;
  /** Display name (3–80 characters) */
  name: string;
  /** Item description (0–500 characters) */
  description: string;
  /** Publisher's USD rate per purchase (e.g. 2.00) */
  baseRateUsd: number;
  /** Derived wholesale token cost: floor(baseRateUsd / 0.10) */
  wholesaleTokenCost: number;
  /** Derived user token cost: ceil(baseRateUsd * 1.35 / 0.10) */
  userTokenCost: number;
  /** Lifecycle status — inactive blocks purchases */
  status: "active" | "inactive" | "deleted";
  /** Display visibility — hidden items are sold only via requestPurchase */
  visibility: "visible" | "hidden";
  /** Optimistic locking version */
  version: number;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last-updated timestamp */
  updatedAt: string;
  /**
   * Minimum Privy level required to purchase this item.
   * 0 = no Privy requirement; 1 = Privy 1 required.
   * When > 0, item cards should display a Privy badge.
   */
  minimumPrivyLevel?: number;
}

/**
 * Request body for creating an in-session purchase.
 */
export interface PurchaseRequest {
  /** ID of the item to purchase */
  itemId: string;
  /** Number of units to purchase (default 1, range 1–1000) */
  quantity?: number;
  /** Client-generated UUIDv4 for idempotency */
  idempotencyKey: string;
  /** Expected unit price (in tokens) — rejects if server price has changed */
  expectedUnitPrice: number;
}

/**
 * Successful purchase confirmation returned by the API.
 */
export interface PurchaseResult {
  /** Unique purchase identifier */
  purchaseId: string;
  /** Item that was purchased */
  itemId: string;
  /** Item display name at purchase time */
  itemName: string;
  /** Number of units purchased */
  quantity: number;
  /** Total tokens deducted (quantity × unit price) */
  totalTokenCost: number;
  /** Organization token balance after the deduction */
  remainingBalance: number;
  /** ISO 8601 timestamp of purchase */
  purchasedAt: string;
  /** Always 'completed' on success */
  status: "completed";
}

/**
 * Error detail returned when a purchase fails.
 */
export interface PurchaseError {
  /** Machine-readable error code */
  code: PurchaseErrorCode;
  /** Human-readable message */
  message: string;
  /** Item ID that the purchase failed for */
  itemId: string;
  /** Current balance (present for insufficient_balance errors) */
  currentBalance?: number;
  /** Item cost (present for insufficient_balance errors) */
  itemCost?: number;
}

/**
 * Pre-flight validation result for a proposed purchase.
 * Use validatePurchase() before showing a confirm UI to surface issues early.
 */
export interface ValidationResult {
  /** Whether the purchase would succeed at this moment */
  canPurchase: boolean;
  /** Human-readable reason when canPurchase is false */
  reason?: string;
  /** Current organization token balance */
  currentBalance: number;
  /** Token cost of the item */
  itemCost: number;
  /** True when session has less than 2 minutes remaining */
  nearExpiry?: boolean;
}

/**
 * A purchase record from the session's purchase history.
 */
export interface SessionPurchase {
  /** Unique purchase identifier */
  purchaseId: string;
  /** Session in which the purchase was made */
  sessionId: string;
  /** Item that was purchased */
  itemId: string;
  /** Item display name at purchase time (denormalized snapshot) */
  itemName: string;
  /** Item description at purchase time (denormalized snapshot) */
  itemDescription: string;
  /** Number of units purchased */
  quantity: number;
  /** Token cost per unit at purchase time */
  unitPrice: number;
  /** Total tokens charged (quantity × unitPrice) */
  totalTokens: number;
  /** Purchase outcome */
  status: "completed" | "failed";
  /** ISO 8601 timestamp of purchase */
  createdAt: string;
}
