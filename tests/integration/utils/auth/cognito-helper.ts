/**
 * Cognito Authentication Helper
 *
 * Provides Cognito authentication for integration tests using SRP (Secure Remote Password).
 * Replicates the pattern from gw-api/scripts/aws_srp.py using AWS SDK v3.
 *
 * Features:
 * - User authentication with username/password using SRP
 * - Token caching to avoid repeated authentication
 * - Automatic token refresh on expiration
 * - Error handling for authentication failures
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import type { AuthTokens, CognitoConfig, TokenCacheEntry } from './types';

export class CognitoAuthHelper {
  private client: CognitoIdentityProviderClient;
  private config: CognitoConfig;
  private tokenCache: TokenCacheEntry | null = null;

  constructor(config: CognitoConfig) {
    this.config = config;
    this.client = new CognitoIdentityProviderClient({
      region: config.region,
    });
  }

  /**
   * Authenticate user and get tokens using SRP
   * Uses cached tokens if still valid
   */
  async authenticate(): Promise<AuthTokens> {
    // Check if cached tokens are still valid
    if (this.tokenCache && this.isTokenValid(this.tokenCache)) {
      console.debug('[CognitoAuthHelper] Using cached tokens');
      return this.tokenCache.tokens;
    }

    console.debug('[CognitoAuthHelper] Authenticating with Cognito using SRP...');

    if (!this.config.username || !this.config.password) {
      throw new Error('Username and password are required for authentication');
    }

    if (!this.config.userPoolId) {
      throw new Error('User Pool ID is required for SRP authentication');
    }

    return new Promise<AuthTokens>((resolve, reject) => {
      try {
        // Create authentication details
        const authenticationDetails = new AuthenticationDetails({
          Username: this.config.username!,
          Password: this.config.password!,
        });

        // Create user pool
        const poolData = {
          UserPoolId: this.config.userPoolId,
          ClientId: this.config.clientId,
        };
        const userPool = new CognitoUserPool(poolData);

        // Create cognito user
        const cognitoUser = new CognitoUser({
          Username: this.config.username!,
          Pool: userPool,
        });

        // Authenticate using SRP
        cognitoUser.authenticateUser(authenticationDetails, {
          onSuccess: (session: CognitoUserSession) => {
            try {
              const accessToken = session.getAccessToken().getJwtToken();
              const refreshToken = session.getRefreshToken().getToken();
              const idToken = session.getIdToken().getJwtToken();
              const expiresIn = session.getAccessToken().getExpiration() - Math.floor(Date.now() / 1000);

              const tokens: AuthTokens = {
                accessToken,
                refreshToken,
                idToken,
                expiresIn,
              };

              // Cache tokens with expiration timestamp
              this.tokenCache = {
                tokens,
                expiresAt: Date.now() + expiresIn * 1000 - 60000, // Subtract 1 minute buffer
              };

              console.debug('[CognitoAuthHelper] ✓ SRP authentication successful');
              resolve(tokens);
            } catch (error) {
              console.error('[CognitoAuthHelper] Failed to extract tokens from session:', error);
              reject(
                new Error(
                  `Failed to extract tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
                )
              );
            }
          },

          onFailure: (err) => {
            console.error('[CognitoAuthHelper] SRP authentication failed:', err);
            reject(new Error(`SRP authentication failed: ${err.message || 'Unknown error'}`));
          },

          newPasswordRequired: (userAttributes, requiredAttributes) => {
            console.error('[CognitoAuthHelper] New password required');
            reject(
              new Error(
                'New password required. Please change password using AWS Cognito console and try again.'
              )
            );
          },
        });
      } catch (error) {
        console.error('[CognitoAuthHelper] SRP authentication setup failed:', error);
        reject(
          new Error(
            `SRP authentication setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });
  }

  /**
   * Refresh tokens using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    console.debug('[CognitoAuthHelper] Refreshing tokens...');

    try {
      const params: InitiateAuthCommandInput = {
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.config.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      };

      const command = new InitiateAuthCommand(params);
      const response = await this.client.send(command);

      if (!response.AuthenticationResult) {
        throw new Error('Token refresh failed: No authentication result returned');
      }

      const { AccessToken, IdToken, ExpiresIn } = response.AuthenticationResult;

      if (!AccessToken || !IdToken || !ExpiresIn) {
        throw new Error('Token refresh failed: Missing required tokens');
      }

      const tokens: AuthTokens = {
        accessToken: AccessToken,
        refreshToken, // Refresh token remains the same
        idToken: IdToken,
        expiresIn: ExpiresIn,
      };

      // Update cache
      this.tokenCache = {
        tokens,
        expiresAt: Date.now() + ExpiresIn * 1000 - 60000,
      };

      console.debug('[CognitoAuthHelper] ✓ Token refresh successful');
      return tokens;
    } catch (error) {
      console.error('[CognitoAuthHelper] Token refresh failed:', error);
      throw new Error(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get valid access token (refreshes if needed)
   */
  async getAccessToken(): Promise<string> {
    const tokens = await this.authenticate();
    return tokens.accessToken;
  }

  /**
   * Get valid ID token (refreshes if needed)
   */
  async getIdToken(): Promise<string> {
    const tokens = await this.authenticate();
    return tokens.idToken;
  }

  /**
   * Check if cached tokens are still valid
   */
  private isTokenValid(cache: TokenCacheEntry): boolean {
    return cache.expiresAt > Date.now();
  }

  /**
   * Validate token format (basic check)
   */
  isValidTokenFormat(token: string): boolean {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Clear cached tokens
   */
  clearCache(): void {
    this.tokenCache = null;
    console.debug('[CognitoAuthHelper] Token cache cleared');
  }
}
