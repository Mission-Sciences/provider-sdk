/**
 * Authenticated API Client
 *
 * HTTP client with automatic authentication token injection and retry logic.
 *
 * Features:
 * - Automatic token injection in Authorization header
 * - Retry logic with exponential backoff for transient failures
 * - Request/response logging for debugging
 * - Error normalization
 * - Timeout handling
 */

import type { CognitoAuthHelper } from '../auth';
import type { RequestConfig, RetryConfig, ApiResponse, ApiError } from './types';

export class AuthenticatedApiClient {
  private authHelper: CognitoAuthHelper;
  private baseUrl: string;
  private defaultTimeout: number;
  private retryConfig: RetryConfig;

  constructor(
    authHelper: CognitoAuthHelper,
    baseUrl: string,
    options?: {
      timeout?: number;
      retryConfig?: Partial<RetryConfig>;
    }
  ) {
    this.authHelper = authHelper;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultTimeout = options?.timeout || 30000;

    this.retryConfig = {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
      ...options?.retryConfig,
    };
  }

  /**
   * Make authenticated GET request
   */
  async get<T = any>(
    url: string,
    params?: Record<string, string | number | boolean>
  ): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
    });
  }

  /**
   * Make authenticated POST request
   */
  async post<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      body: data,
    });
  }

  /**
   * Make authenticated PUT request
   */
  async put<T = any>(url: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      body: data,
    });
  }

  /**
   * Make authenticated DELETE request
   */
  async delete<T = any>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
    });
  }

  /**
   * Make authenticated PATCH request
   */
  async patch<T = any>(url: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      url,
      body: data,
    });
  }

  /**
   * Make authenticated HTTP request with retry logic
   */
  async request<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
    return this.retryRequest(async () => {
      const token = await this.authHelper.getIdToken();
      const fullUrl = this.buildUrl(config.url, config.params);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...config.headers,
      };

      console.debug(`[AuthenticatedApiClient] ${config.method} ${fullUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        config.timeout || this.defaultTimeout
      );

      try {
        const response = await fetch(fullUrl, {
          method: config.method,
          headers,
          body: config.body ? JSON.stringify(config.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Handle non-JSON responses (e.g., 204 No Content)
        let data: T;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = (await response.text()) as any;
        }

        if (!response.ok) {
          const error: ApiError = {
            message: (data as any)?.error || (data as any)?.message || response.statusText,
            status: response.status,
            code: (data as any)?.code,
            details: data,
          };

          console.error(
            `[AuthenticatedApiClient] Request failed: ${config.method} ${fullUrl}`,
            error
          );

          throw error;
        }

        console.debug(
          `[AuthenticatedApiClient] ✓ ${config.method} ${fullUrl} - ${response.status}`
        );

        return {
          data,
          status: response.status,
          headers: responseHeaders,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        if ((error as any).name === 'AbortError') {
          throw {
            message: 'Request timeout',
            status: 408,
            code: 'TIMEOUT',
          } as ApiError;
        }

        throw error;
      }
    });
  }

  /**
   * Retry request with exponential backoff
   */
  private async retryRequest<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    let lastError: any;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry if not a retryable error
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          throw error;
        }

        console.warn(
          `[AuthenticatedApiClient] Retry ${attempt}/${this.retryConfig.maxAttempts} after ${delay}ms...`
        );

        await this.sleep(delay);
        delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const status = error?.status;

    if (!status) {
      // Network errors are retryable
      return error?.code === 'TIMEOUT' || error?.name === 'NetworkError';
    }

    return this.retryConfig.retryableStatuses.includes(status);
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const queryString = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update retry configuration
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = {
      ...this.retryConfig,
      ...config,
    };
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}
