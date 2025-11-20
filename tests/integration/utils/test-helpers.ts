/**
 * Test helper utilities
 */

/**
 * Helper to check if a value is one of the expected values
 * Use this instead of expect.oneOf which doesn't exist in Vitest
 *
 * @example
 * const error = await getError()
 * expect(oneOf(error.status, [400, 401, 422])).toBe(true)
 */
export function oneOf<T>(value: T, options: T[]): boolean {
  return options.includes(value);
}

/**
 * Custom matcher to check if status is one of multiple values
 * @example
 * expect(response.status).toBeOneOf([200, 201, 204])
 */
export function toBeOneOf(received: any, expected: any[]) {
  const pass = expected.includes(received);
  return {
    pass,
    message: () =>
      pass
        ? `expected ${received} not to be one of ${JSON.stringify(expected)}`
        : `expected ${received} to be one of ${JSON.stringify(expected)}`,
  };
}
