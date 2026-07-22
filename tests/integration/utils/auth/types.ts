/**
 * Authentication Types
 *
 * TypeScript interfaces for authentication tokens and configuration.
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
  username?: string;
  password?: string;
}

export interface TokenCacheEntry {
  tokens: AuthTokens;
  expiresAt: number;
}
