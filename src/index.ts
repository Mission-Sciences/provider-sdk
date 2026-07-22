/**
 * Marketplace Provider SDK
 * JWT-based session management for application providers
 */

// Main SDK class
export { MarketplaceSDK } from "./core/MarketplaceSDK";

// Core utilities
export { JWTParser } from "./core/JWTParser";
export { JWKSValidator } from "./core/JWKSValidator";
export { TimerManager } from "./core/TimerManager";

// Phase 2 utilities
export { HeartbeatManager } from "./core/HeartbeatManager";
export { TabSyncManager } from "./core/TabSyncManager";
export type { TabSyncMessage } from "./core/TabSyncManager";

// UI Components
export { WarningModal } from "./ui/WarningModal";
export { SessionHeader } from "./ui/SessionHeader";
export { PurchaseModal } from "./ui/PurchaseModal";
export type { PurchaseItem, PurchaseModalOptions } from "./ui/PurchaseModal";
export { PrivyBadge } from "./ui/PrivyBadge";
export { PrivyRequiredModal } from "./ui/PrivyRequiredModal";
export type { PrivyRequiredModalOptions } from "./ui/PrivyRequiredModal";
export { DurationSlider } from "./ui/DurationSlider";
export type { DurationSliderOptions } from "./ui/DurationSlider";
export { ExtensionModal } from "./ui/ExtensionModal";
export type { ExtensionModalOptions } from "./ui/ExtensionModal";

// Styling & Theme
export {
  lightTheme,
  darkTheme,
  getTheme,
  generateCSSVariables,
  generateSessionControlsVars,
  mergeThemeTokens,
  toCssVarString,
} from "./styles/theme";
export type {
  Theme,
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
} from "./styles/theme";

// Types
export type {
  SDKConfig,
  SessionData,
  SDKEvents,
  ModalStyles,
  ThemeMode,
  JWTHeader,
  JWTClaims,
  JWKSKey,
  JWKSResponse,
  SessionLifecycleHooks,
  SessionStartContext,
  SessionEndContext,
  SessionExtendContext,
  SessionWarningContext,
  TokenBalance,
  ExtensionCost,
  ExtensionCostResult,
  ExtendSessionOptions,
  PurchaseResult,
  // Session controls widget (GW-5294)
  Position,
  TimerFormat,
  SessionControlLink,
  FadeConfig,
  SessionControlsConfig,
  ThemeTokens,
} from "./types";

// Session controls mount option types (GW-5294)
export type {
  SessionHeaderMountOptions,
  LegacySessionHeaderOptions,
} from "./ui/SessionHeader";

export { SDKError } from "./types";

// Purchase State and Types
export { PURCHASE_STATE } from "./types/purchases";
export type {
  PurchaseState,
  PurchaseError,
  PurchaseErrorCode,
  PurchaseRequest,
  ApplicationItem,
  ValidationResult,
  SessionPurchase,
  PrivyRequiredError,
} from "./types/purchases";

// Marketplace Search Types
export type {
  MarketplaceSearchRequest,
  MarketplaceSearchEnrichRequest,
  EngagementTrackRequest,
  MarketplaceApplicationData,
  MarketplaceDatasetData,
  MarketplaceSearchResult,
  MarketplaceApplicationResult,
  MarketplaceDatasetResult,
  MarketplaceSearchResponse,
  EnrichedResult,
  MarketplaceSearchEnrichResponse,
  AutocompleteResult,
  AutocompleteResponse,
  KeywordItem,
  KeywordsResponse,
  MarketplaceSearchSuggestionsResponse,
} from "./types";

// Environment Configuration
export type { Environment, EnvironmentConfig } from "./types/environment";
export { ENVIRONMENT_CONFIGS } from "./types/environment";

// Utilities
export { extractTokenFromURL, isBrowser } from "./utils/url";
export { Logger } from "./utils/logger";
export { getEnvironmentConfig, createSDKConfig } from "./utils/environment";

// Default export
export { MarketplaceSDK as default } from "./core/MarketplaceSDK";
