/**
 * JWT token shape guards (GW-8643).
 *
 * A prior page load could persist the literal string "undefined" (or "null",
 * or an empty string) under the sessionStorage JWT key. Reading that value
 * back and sending it to JWKS verification fails with a cryptic
 * "Invalid Compact JWS" error. These guards treat such values as absent.
 */

/**
 * Returns true when the value looks like a compact JWS/JWT:
 * a non-empty string with exactly three non-empty dot-separated parts.
 * Rejects the literal strings "undefined" and "null" (artifacts of
 * stringifying nullish values into storage).
 */
export function isLikelyJwt(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const trimmed = token.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "null") {
    return false;
  }
  const parts = trimmed.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}
