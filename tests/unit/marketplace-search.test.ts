/**
 * Unit tests for MarketplaceApplicationData type (GW-4607)
 *
 * Regression tests ensuring MarketplaceSearchResult.data is typed with
 * minimumPrivyLevel so publisher SDK consumers can access the field without
 * unsafe casts from Record<string, unknown>.
 */

import { describe, it, expect } from "vitest";
import type {
  MarketplaceApplicationData,
  MarketplaceSearchResult,
  MarketplaceDatasetData,
} from "../../src/types/marketplace-search";

describe("MarketplaceApplicationData", () => {
  it("accepts minimumPrivyLevel of 0 (no privy required)", () => {
    const data: MarketplaceApplicationData = {
      name: "Test App",
      minimumPrivyLevel: 0,
    };
    expect(data.minimumPrivyLevel).toBe(0);
  });

  it("accepts minimumPrivyLevel of 1 (privy 1 required)", () => {
    const data: MarketplaceApplicationData = {
      name: "Restricted App",
      minimumPrivyLevel: 1,
    };
    expect(data.minimumPrivyLevel).toBe(1);
  });

  it("allows minimumPrivyLevel to be omitted (optional field)", () => {
    const data: MarketplaceApplicationData = {
      name: "App without restriction",
    };
    expect(data.minimumPrivyLevel).toBeUndefined();
  });

  it("allows unknown fields via index signature (forward-compatible)", () => {
    const data: MarketplaceApplicationData = {
      name: "App",
      minimumPrivyLevel: 1,
      futureField: "some-value",
    };
    expect(data["futureField"]).toBe("some-value");
  });
});

describe("MarketplaceSearchResult.data — minimumPrivyLevel regression (GW-4607)", () => {
  it("can read minimumPrivyLevel directly from result.data without casting", () => {
    const result: MarketplaceSearchResult = {
      id: "app-123",
      resultType: "application",
      type: "application",
      relevanceScore: 0.95,
      matchReason: "keyword match",
      data: {
        name: "OSINT Lookup",
        minimumPrivyLevel: 1,
      },
      trendingScore: 10,
      popularScore: 20,
      isPromoted: false,
    };

    // This is the core regression: result.data.minimumPrivyLevel must be
    // accessible without a cast from Record<string, unknown>.
    expect(result.data.minimumPrivyLevel).toBe(1);
  });

  it("minimumPrivyLevel is undefined when not returned by API", () => {
    const result: MarketplaceSearchResult = {
      id: "app-456",
      resultType: "application",
      type: "application",
      relevanceScore: 0.8,
      matchReason: null,
      data: {
        name: "Open Access App",
      },
      trendingScore: 5,
      popularScore: 3,
      isPromoted: false,
    };

    expect(result.data.minimumPrivyLevel).toBeUndefined();
  });

  it("dataset results use MarketplaceDatasetData — minimumPrivyLevel present (datasets have this field)", () => {
    const datasetData: MarketplaceDatasetData = {
      name: "Public Dataset",
      minimumPrivyLevel: 0,
    };
    const result: MarketplaceSearchResult = {
      id: "dataset-789",
      resultType: "dataset",
      type: "dataset",
      relevanceScore: 0.7,
      matchReason: null,
      data: datasetData,
      trendingScore: 2,
      popularScore: 8,
      isPromoted: true,
    };

    // Datasets have MinimumPrivyLevel int in gw-go-common/models/dataset.go (line 419)
    expect(result.data.minimumPrivyLevel).toBe(0);
  });
});
