import { SDKError } from '../types';

/**
 * Extract JWT token from URL parameter
 * @param paramName - URL parameter name (default: 'gwSession')
 * @param url - URL to extract from (default: window.location.href)
 * @returns JWT token or null if not found
 */
export function extractTokenFromURL(
  paramName: string = 'gwSession',
  url?: string
): string | null {
  try {
    const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

    if (!targetUrl) {
      return null;
    }

    const urlObj = new URL(targetUrl);
    const token = urlObj.searchParams.get(paramName);

    return token;
  } catch (error) {
    throw new SDKError(
      `Failed to extract token from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'URL_PARSE_ERROR'
    );
  }
}

/**
 * Check if code is running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}
