import React from "react";
import { usePurchaseButton } from "../hooks/usePurchaseButton";
import type {
  PurchaseResult,
  PurchaseError,
  PrivyRequiredError,
} from "../types/purchases";

type ButtonVariant = "primary" | "secondary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

/**
 * Theme overrides for GWPurchaseButton.
 */
export interface GWPurchaseButtonTheme {
  /** Background colour for the default (idle) state */
  backgroundColor?: string;
  /** Text colour */
  color?: string;
  /** Border radius */
  borderRadius?: string;
}

/**
 * Render prop payload passed to the children function.
 */
export interface GWPurchaseButtonRenderProps {
  /** Execute the purchase */
  purchase: () => Promise<PurchaseResult>;
  /** Whether a purchase is in flight */
  isPurchasing: boolean;
  /** Whether the purchase can proceed */
  canPurchase: boolean;
  /** Whether the user has insufficient balance */
  insufficientFunds: boolean;
  /**
   * Whether the item requires Privy verification the user has not yet
   * completed. When true, show an upgrade prompt rather than a generic error.
   */
  privyRequired: boolean;
  /** Privy-specific error detail when privyRequired is true, else null */
  privyError: PrivyRequiredError | null;
  /** Token cost for the item */
  price: number | undefined;
  /** Any error from the last purchase */
  error: PurchaseError | null;
  /** Whether this item requires Privy verification (badge indicator) */
  requiresPrivy: boolean;
}

/**
 * Props for GWPurchaseButton.
 */
export interface GWPurchaseButtonProps {
  /** ID of the marketplace item to purchase */
  itemId: string;
  /** Number of units to purchase (default: 1) */
  quantity?: number;
  /** Additional CSS class names */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Theme colour overrides */
  theme?: GWPurchaseButtonTheme;
  /** Visual variant (default: "primary") */
  variant?: ButtonVariant;
  /** Size preset (default: "md") */
  size?: ButtonSize;
  /** Whether the button should occupy full width */
  fullWidth?: boolean;
  /** Button label; falls back to the item name when omitted */
  children?: React.ReactNode;
  /** Whether to show the token price next to the label (default: true) */
  showPrice?: boolean;
  /** Whether to show a cart icon (default: false) */
  showIcon?: boolean;
  /**
   * Whether to show a "Privy 1" badge when the item requires Privy
   * verification (default: true).
   */
  showPrivyBadge?: boolean;
  /** Called with the purchase result on success */
  onSuccess?: (result: PurchaseResult) => void;
  /** Called with the error on failure */
  onError?: (error: PurchaseError) => void;
  /**
   * Render prop for full customisation.
   * When provided, the default button is not rendered.
   */
  render?: (props: GWPurchaseButtonRenderProps) => React.ReactNode;
}

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: "4px 10px", fontSize: "0.75rem" },
  md: { padding: "8px 16px", fontSize: "0.875rem" },
  lg: { padding: "12px 24px", fontSize: "1rem" },
};

const VARIANT_BASE: React.CSSProperties = {
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

function variantStyle(
  variant: ButtonVariant,
  theme?: GWPurchaseButtonTheme,
): React.CSSProperties {
  switch (variant) {
    case "secondary":
      return {
        backgroundColor: theme?.backgroundColor ?? "#e2e8f0",
        color: theme?.color ?? "#1a202c",
        borderRadius: theme?.borderRadius,
      };
    case "outline":
      return {
        backgroundColor: "transparent",
        border: `2px solid ${theme?.backgroundColor ?? "#3b82f6"}`,
        color: theme?.color ?? "#3b82f6",
        borderRadius: theme?.borderRadius,
      };
    default:
      return {
        backgroundColor: theme?.backgroundColor ?? "#3b82f6",
        color: theme?.color ?? "#ffffff",
        borderRadius: theme?.borderRadius,
      };
  }
}

/**
 * Styleable purchase button component.
 *
 * Supports render props for full customisation while providing a sensible
 * default UI out of the box.
 *
 * @example
 * ```tsx
 * // Default usage
 * <GWPurchaseButton itemId="item-1" onSuccess={(r) => console.log(r)} />
 *
 * // Render prop — full control
 * <GWPurchaseButton itemId="item-1">
 *   {({ purchase, isPurchasing, canPurchase }) => (
 *     <MyStyledButton disabled={!canPurchase} onClick={purchase}>
 *       {isPurchasing ? 'Buying…' : 'Purchase'}
 *     </MyStyledButton>
 *   )}
 * </GWPurchaseButton>
 * ```
 */
export function GWPurchaseButton({
  itemId,
  quantity = 1,
  className,
  style,
  theme,
  variant = "primary",
  size = "md",
  fullWidth = false,
  children,
  showPrice = true,
  showIcon = false,
  showPrivyBadge = true,
  onSuccess,
  onError,
  render,
}: GWPurchaseButtonProps): React.ReactElement {
  const {
    item,
    canPurchase,
    insufficientFunds,
    privyRequired,
    privyError,
    purchase: rawPurchase,
    isPurchasing,
    error,
  } = usePurchaseButton(itemId, quantity);

  const purchase = async (): Promise<PurchaseResult> => {
    try {
      const result = await rawPurchase();
      onSuccess?.(result);
      return result;
    } catch (err) {
      const purchaseError = err as PurchaseError;
      onError?.(purchaseError);
      throw purchaseError;
    }
  };

  // Item requires Privy verification if minimumPrivyLevel > 0.
  const requiresPrivy = (item?.minimumPrivyLevel ?? 0) > 0;

  const renderProps: GWPurchaseButtonRenderProps = {
    purchase,
    isPurchasing,
    canPurchase,
    insufficientFunds,
    privyRequired,
    privyError,
    requiresPrivy,
    price: item?.userTokenCost,
    error,
  };

  if (render) {
    return <>{render(renderProps)}</>;
  }

  const label = children ?? item?.name ?? itemId;
  const priceLabel =
    showPrice && item ? ` (${item.userTokenCost * quantity} tokens)` : "";

  const computedStyle: React.CSSProperties = {
    ...VARIANT_BASE,
    ...SIZE_STYLES[size],
    ...variantStyle(variant, theme),
    width: fullWidth ? "100%" : undefined,
    opacity: !canPurchase || isPurchasing ? 0.5 : 1,
    ...style,
  };

  const privyBadgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 6px",
    backgroundColor: "#3b82f6",
    color: "#ffffff",
    borderRadius: "9999px",
    fontSize: "0.65rem",
    fontWeight: 600,
    lineHeight: "1.25",
    whiteSpace: "nowrap",
    userSelect: "none",
    marginLeft: "4px",
  };

  return (
    <button
      className={className}
      style={computedStyle}
      disabled={!canPurchase || isPurchasing}
      onClick={purchase}
      type="button"
      aria-busy={isPurchasing}
    >
      {showIcon && <span aria-hidden="true">🛒</span>}
      {isPurchasing ? "Purchasing…" : `${label}${priceLabel}`}
      {showPrivyBadge && requiresPrivy && (
        <span
          style={privyBadgeStyle}
          aria-label="Requires Privy 1 verification"
          title="This item requires Privy 1 verification"
        >
          Privy 1
        </span>
      )}
    </button>
  );
}
