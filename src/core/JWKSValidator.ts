import { createRemoteJWKSet, jwtVerify, JWTVerifyResult, JWTPayload } from 'jose';
import { SDKError, JWTClaims } from '../types';
import { Logger } from '../utils/logger';

/**
 * JWKS Validator for RS256 JWT signature verification
 * Uses jose library for browser and Node.js compatibility
 */
export class JWKSValidator {
  private jwksUri: string;
  private logger: Logger;
  private jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(jwksUri: string, debug: boolean = false) {
    this.jwksUri = jwksUri;
    this.logger = new Logger(debug, '[JWKSValidator]');

    // Create JWKS fetcher (works in browser and Node.js)
    // Resolve relative URIs against the page origin in browser environments
    const resolvedUrl = this.jwksUri.startsWith('http')
      ? new URL(this.jwksUri)
      : new URL(this.jwksUri, typeof window !== 'undefined' ? window.location.origin : undefined);
    this.jwks = createRemoteJWKSet(resolvedUrl);

    this.logger.info('Initialized with JWKS URI:', this.jwksUri);
  }

  /**
   * Verify JWT signature using JWKS public key
   * @param token - JWT token to verify
   * @param expectedIssuer - Expected issuer (default: 'generalwisdom.com')
   * @param expectedApplicationId - Optional application ID to validate
   * @returns Decoded and verified JWT claims
   */
  async verify(
    token: string,
    expectedIssuer: string = 'generalwisdom.com',
    expectedApplicationId?: string
  ): Promise<JWTClaims> {
    this.logger.log('Verifying JWT signature...');

    try {
      // Verify JWT using JWKS
      const result: JWTVerifyResult = await jwtVerify(token, this.jwks, {
        issuer: expectedIssuer,
        algorithms: ['RS256'],
      });

      const payload = result.payload as JWTPayload & Partial<JWTClaims>;

      // Validate required claims
      const requiredClaims: (keyof JWTClaims)[] = [
        'sessionId',
        'userId',
        'orgId',
        'applicationId',
        'exp',
        'iat',
      ];

      for (const claim of requiredClaims) {
        if (!(claim in payload)) {
          throw new SDKError(
            `Missing required claim: ${claim}`,
            'MISSING_CLAIM'
          );
        }
      }

      // Validate application ID if provided
      if (expectedApplicationId && payload.applicationId !== expectedApplicationId) {
        this.logger.error(
          `Application ID mismatch: expected ${expectedApplicationId}, got ${payload.applicationId}`
        );
        throw new SDKError(
          'Token is for a different application',
          'APPLICATION_MISMATCH'
        );
      }

      const claims: JWTClaims = {
        sessionId: payload.sessionId!,
        applicationId: payload.applicationId!,
        userId: payload.userId!,
        orgId: payload.orgId!,
        startTime: payload.startTime!,
        durationMinutes: payload.durationMinutes!,
        iat: payload.iat!,
        exp: payload.exp!,
        iss: payload.iss!,
        sub: payload.sub!,
      };

      this.logger.log('JWT verified successfully');
      return claims;

    } catch (error) {
      this.logger.error('JWT verification failed:', error);

      if (error instanceof SDKError) {
        throw error;
      }

      // Handle jose-specific errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'JWTExpired' || errorMessage.includes('expired')) {
        throw new SDKError('Session expired', 'SESSION_EXPIRED');
      }

      if (errorName === 'JWSSignatureVerificationFailed') {
        throw new SDKError('Invalid JWT signature', 'INVALID_SIGNATURE');
      }

      if (errorName === 'JWTClaimValidationFailed') {
        throw new SDKError(`JWT claim validation failed: ${errorMessage}`, 'INVALID_CLAIM');
      }

      throw new SDKError(
        `JWT verification failed: ${errorMessage}`,
        'VERIFICATION_FAILED'
      );
    }
  }

  /**
   * Update JWKS URI
   * @param jwksUri - New JWKS URI
   */
  updateJwksUri(jwksUri: string): void {
    this.jwksUri = jwksUri;
    const resolvedUrl = this.jwksUri.startsWith('http')
      ? new URL(this.jwksUri)
      : new URL(this.jwksUri, typeof window !== 'undefined' ? window.location.origin : undefined);
    this.jwks = createRemoteJWKSet(resolvedUrl);
    this.logger.info('Updated JWKS URI:', this.jwksUri);
  }
}
