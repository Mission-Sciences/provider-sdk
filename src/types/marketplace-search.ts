/**
 * Marketplace Search Types for Publisher SDK
 *
 * Types for the public marketplace search API endpoints.
 * These endpoints do NOT require authentication.
 */

// Request Types

export interface MarketplaceSearchRequest {
  query: string;
  categories?: ("application" | "dataset")[];
  itemTypes?: ("application" | "dataset")[];
  limit?: number;
  cursor?: string;
  sortBy?: "relevance" | "trending" | "popular" | "newest";
}

export interface MarketplaceSearchEnrichRequest {
  searchRequestId: string;
  resultIds: string[];
  query: string;
}

export interface EngagementTrackRequest {
  catalogItemId: string;
  catalogItemType: "APPLICATION" | "DATASET" | "SERVICE";
  eventType:
    | "CLICK"
    | "VIEW"
    | "SESSION_LAUNCH"
    | "DATASET_QUERY"
    | "RFI_SUBMIT";
  searchRequestId?: string;
}

// Response Types

/** Audience restriction type for a catalog item. */
export type AudienceType = "ORG_ALLOWLIST" | "GRANT_REQUIRED";

/** References a named grant required for access. */
export interface GrantRef {
  name: string;
}

/** Defines visibility and access restrictions for a catalog item. */
export interface Audience {
  type: AudienceType;
  grants?: GrantRef[];
}

/**
 * Typed data payload for an application catalog item returned by marketplace search.
 *
 * Field names match the Go JSON tags in gw-go-common/models/application.go.
 * Use this interface when `MarketplaceSearchResult.resultType === "application"` to
 * access `minimumPrivyLevel` and other catalog fields in a type-safe way.
 *
 * An index signature is included so that unknown fields returned by future API
 * versions do not cause a TypeScript error.
 */
export interface MarketplaceApplicationData {
  /** Display name of the application */
  name?: string;
  /** Short description */
  description?: string;
  /** Application category */
  category?: string;
  /** Publisher / organization name */
  publisherName?: string;
  /** Base session price in SMART tokens */
  basePrice?: number;
  /** Thumbnail image URL */
  thumbnailUrl?: string;
  /**
   * Minimum Privy level required to launch a session for this application.
   * 0 means no Privy requirement; 1 means Privy 1 is required.
   * When > 0, item cards should display a PrivyBadge.
   *
   * Matches Go model: MinimumPrivyLevel int `json:"minimumPrivyLevel"`
   *
   * @deprecated Use audience.grants instead
   */
  minimumPrivyLevel?: number;
  /** Defines visibility and access restrictions for this application */
  audience?: Audience;
  /** Whether the application is currently active */
  isActive?: boolean;
  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * Typed data payload for a dataset catalog item returned by marketplace search.
 *
 * Field names match the Go JSON tags in gw-go-common/models/dataset.go.
 * Use this interface when `MarketplaceSearchResult.resultType === "dataset"` to
 * access dataset-specific fields in a type-safe way.
 *
 * An index signature is included so that unknown fields returned by future API
 * versions do not cause a TypeScript error.
 */
export interface MarketplaceDatasetData {
  /** Display name of the dataset */
  name?: string;
  /** Short description */
  description?: string;
  /** Publisher / organization name */
  publisherName?: string;
  /** Thumbnail / icon image URL */
  iconUrl?: string;
  /**
   * Minimum Privy level required to query this dataset.
   * 0 means no Privy requirement; 1 means Privy 1 is required.
   * When > 0, item cards should display a PrivyBadge.
   *
   * Matches Go model: MinimumPrivyLevel int `json:"minimumPrivyLevel"`
   *
   * @deprecated Use audience.grants instead
   */
  minimumPrivyLevel?: number;
  /** Defines visibility and access restrictions for this dataset */
  audience?: Audience;
  /** Dataset visibility: "public" | "private" | "org" */
  visibility?: string;
  /** Dataset status: "active" | "inactive" | "archived" */
  status?: string;
  /** Additional metadata fields */
  [key: string]: unknown;
}

/** Common fields shared by both application and dataset search results. */
interface MarketplaceSearchResultBase {
  id: string;
  relevanceScore: number;
  matchReason: string | null;
  trendingScore: number;
  popularScore: number;
  isPromoted: boolean;
}

export interface MarketplaceApplicationResult extends MarketplaceSearchResultBase {
  resultType: "application";
  /** @deprecated Use `resultType` — the `type` field is kept for backward compatibility */
  type: "application";
  data: MarketplaceApplicationData;
}

export interface MarketplaceDatasetResult extends MarketplaceSearchResultBase {
  resultType: "dataset";
  /** @deprecated Use `resultType` — the `type` field is kept for backward compatibility */
  type: "dataset";
  data: MarketplaceDatasetData;
}

export type MarketplaceSearchResult =
  | MarketplaceApplicationResult
  | MarketplaceDatasetResult;

export interface MarketplaceSearchResponse {
  results: MarketplaceSearchResult[];
  suggestions: string[];
  totalResults: number;
  query: string;
  searchRequestId: string;
  cursor?: string;
  hasMore: boolean;
}

export interface EnrichedResult {
  id: string;
  matchReason: string | null;
  relevanceScore: number;
}

export interface MarketplaceSearchEnrichResponse {
  searchRequestId: string;
  enrichedResults: EnrichedResult[];
  suggestions: string[];
}

export interface AutocompleteResult {
  id: string;
  name: string;
  itemType: string;
  score: number;
}

export interface AutocompleteResponse {
  results: AutocompleteResult[];
  query: string;
}

export interface KeywordItem {
  keyword: string;
  count: number;
}

export interface KeywordsResponse {
  keywords: KeywordItem[];
  total: number;
}

export interface MarketplaceSearchSuggestionsResponse {
  suggestions: string[];
  totalTracked: number;
}
