import { SDKError, JWTHeader, JWTClaims } from '../types';

/**
 * JWT Parser for client-side token decoding
 * Note: Does NOT verify signature - use JWKSValidator for verification
 */
export class JWTParser {
  /**
   * Decode JWT payload without verification
   * @param token - JWT token string
   * @returns Decoded payload
   */
  static decode(token: string): JWTClaims {
    if (!token || typeof token !== 'string') {
      throw new SDKError('Invalid JWT token format', 'INVALID_TOKEN');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new SDKError('Malformed JWT token - expected 3 parts', 'MALFORMED_TOKEN');
    }

    try {
      const payload = parts[1];
      const decoded = this.base64UrlDecode(payload);
      return JSON.parse(decoded) as JWTClaims;
    } catch (error) {
      throw new SDKError(
        `Failed to decode JWT payload: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DECODE_ERROR'
      );
    }
  }

  /**
   * Decode JWT header
   * @param token - JWT token string
   * @returns Decoded header
   */
  static decodeHeader(token: string): JWTHeader {
    if (!token || typeof token !== 'string') {
      throw new SDKError('Invalid JWT token format', 'INVALID_TOKEN');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new SDKError('Malformed JWT token - expected 3 parts', 'MALFORMED_TOKEN');
    }

    try {
      const header = parts[0];
      const decoded = this.base64UrlDecode(header);
      return JSON.parse(decoded) as JWTHeader;
    } catch (error) {
      throw new SDKError(
        `Failed to decode JWT header: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DECODE_ERROR'
      );
    }
  }

  /**
   * Extract specific claim from JWT
   * @param token - JWT token string
   * @param claim - Claim name to extract
   * @returns Claim value
   */
  static extractClaim<T = any>(token: string, claim: string): T {
    const payload = this.decode(token);
    return (payload as any)[claim];
  }

  /**
   * Check if JWT is expired (client-side only, not authoritative)
   * @param token - JWT token string
   * @returns True if token is expired
   */
  static isExpired(token: string): boolean {
    const payload = this.decode(token);
    const exp = payload.exp;

    if (!exp) {
      return false;
    }

    // exp is in seconds, Date.now() is in milliseconds
    return Date.now() >= exp * 1000;
  }

  /**
   * Get time remaining until expiration
   * @param token - JWT token string
   * @returns Seconds remaining (0 if expired)
   */
  static getTimeRemaining(token: string): number {
    const payload = this.decode(token);
    const exp = payload.exp;

    if (!exp) {
      return 0;
    }

    const remaining = exp - Math.floor(Date.now() / 1000);
    return Math.max(0, remaining);
  }

  /**
   * Base64 URL decode
   * @param str - Base64 URL encoded string
   * @returns Decoded string
   */
  private static base64UrlDecode(str: string): string {
    // Replace URL-safe characters
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    const padding = base64.length % 4;
    if (padding) {
      base64 += '='.repeat(4 - padding);
    }

    try {
      // Use Buffer in Node.js, atob in browser
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(base64, 'base64').toString('utf-8');
      } else if (typeof atob !== 'undefined') {
        return atob(base64);
      } else {
        throw new Error('No base64 decoding available');
      }
    } catch (error) {
      throw new SDKError(
        'Invalid base64 encoding',
        'ENCODING_ERROR'
      );
    }
  }
}
