/**
 * Environment Configuration Types
 *
 * Defines environment-specific configuration for the SDK.
 */

/**
 * Available environments for the SDK
 */
export type Environment = "production" | "demo" | "dev";

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  /** JWKS endpoint URL for JWT signature verification */
  jwksUri: string;
  /** SDK API endpoint for all backend operations */
  apiEndpoint: string;
  /** Marketplace URL for redirects */
  marketplaceUrl: string;
  /** Expected JWT issuer for validation */
  issuer: string;
}

/**
 * Pre-configured environment settings
 */
export const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentConfig> = {
  production: {
    jwksUri: "https://api.generalwisdom.com/.well-known/jwks.json",
    apiEndpoint: "https://sdk.platform.generalwisdom.com/v1",
    marketplaceUrl: "https://d3p2yqofgy75sz.cloudfront.net/",
    issuer: "generalwisdom.com",
  },
  demo: {
    jwksUri: "https://demo-api.generalwisdom.com/.well-known/jwks.json",
    apiEndpoint: "https://sdk.demo.generalwisdom.com/v1",
    marketplaceUrl: "https://demo.generalwisdom.com/",
    issuer: "demo.generalwisdom.com",
  },
  dev: {
    jwksUri: "https://api.dev.generalwisdom.com/.well-known/jwks.json",
    apiEndpoint: "https://sdk.dev.generalwisdom.com/v1",
    marketplaceUrl: "https://dev.generalwisdom.com/",
    issuer: "generalwisdom.com",
  },
};
