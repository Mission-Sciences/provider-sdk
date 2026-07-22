/**
 * Environment Utilities
 *
 * Helper functions for working with SDK environments.
 */

import { SDKConfig } from "../types";
import {
  Environment,
  EnvironmentConfig,
  ENVIRONMENT_CONFIGS,
} from "../types/environment";

/**
 * Get the configuration for a specific environment
 *
 * @param environment - The target environment
 * @returns Environment-specific configuration
 *
 * @example
 * ```typescript
 * const demoConfig = getEnvironmentConfig('demo');
 * console.log(demoConfig.apiEndpoint); // 'https://demo-api.generalwisdom.com'
 * ```
 */
export function getEnvironmentConfig(
  environment: Environment,
): EnvironmentConfig {
  return ENVIRONMENT_CONFIGS[environment];
}

/**
 * Create an SDK configuration for a specific environment
 *
 * This helper function simplifies SDK initialization by automatically
 * applying environment-specific defaults while allowing overrides.
 *
 * @param environment - The target environment ('production' or 'demo')
 * @param overrides - Optional configuration overrides
 * @returns Complete SDK configuration with environment defaults
 *
 * @example
 * ```typescript
 * // Simple usage
 * const sdk = new MarketplaceSDK(createSDKConfig('demo', {
 *   applicationId: 'my-app'
 * }));
 *
 * // With custom overrides
 * const sdk = new MarketplaceSDK(createSDKConfig('demo', {
 *   applicationId: 'my-app',
 *   debug: true,
 *   warningThresholdSeconds: 120
 * }));
 * ```
 */
export function createSDKConfig(
  environment: Environment,
  overrides?: Partial<SDKConfig>,
): SDKConfig {
  const envConfig = getEnvironmentConfig(environment);

  return {
    environment,
    jwksUri: envConfig.jwksUri,
    apiEndpoint: envConfig.apiEndpoint,
    marketplaceUrl: envConfig.marketplaceUrl,
    ...overrides,
  };
}
