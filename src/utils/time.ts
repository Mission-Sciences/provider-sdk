/**
 * Normalise a session-expiry value to Unix seconds.
 *
 * The backend expresses expiry in two shapes depending on the endpoint:
 *  - POST /sdk/sessions/{id}/extend returns a Unix-SECONDS number
 *    (see pact/consumers/sessions.pact.spec.ts and the onSessionExtended /
 *    SessionExtendContext types, both documented as "Unix seconds").
 *  - GET .../extension-cost returns an ISO 8601 string (ExtensionCostResult).
 *
 * A seconds number must NOT be passed to `new Date(number)`, which interprets
 * the value as milliseconds — that yields a ~1970 timestamp and a large
 * negative remaining time (GW-8308). This helper branches on the runtime type:
 * numbers are already seconds; strings are parsed as dates and converted.
 *
 * @param value - expiry as a Unix-seconds number or an ISO 8601 string
 * @returns expiry as Unix seconds (integer)
 */
export function normalizeExpiryToSeconds(value: number | string): number {
  if (typeof value === "number") {
    // Already Unix seconds — floor to guard against fractional inputs.
    return Math.floor(value);
  }
  return Math.floor(new Date(value).getTime() / 1000);
}
