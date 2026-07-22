/**
 * Unit tests for the expiry-normalisation helper (GW-8308).
 */
import { describe, it, expect } from 'vitest';
import { normalizeExpiryToSeconds } from '../../src/utils/time';

describe('normalizeExpiryToSeconds', () => {
  it('treats a number as Unix seconds (does NOT reinterpret as milliseconds)', () => {
    // 1717203600 = 2024-06-01T01:00:00Z. The old code did
    // `new Date(1717203600).getTime() / 1000` which reads it as ms → ~1970.
    expect(normalizeExpiryToSeconds(1717203600)).toBe(1717203600);
  });

  it('floors fractional seconds numbers', () => {
    expect(normalizeExpiryToSeconds(1717203600.9)).toBe(1717203600);
  });

  it('parses an ISO 8601 string to Unix seconds', () => {
    const iso = '2024-06-01T01:00:00.000Z';
    const expected = Math.floor(new Date(iso).getTime() / 1000);
    expect(normalizeExpiryToSeconds(iso)).toBe(expected);
    expect(normalizeExpiryToSeconds(iso)).toBe(1717203600);
  });

  it('a seconds number and its ISO-string equivalent normalise identically', () => {
    const seconds = 1784311809; // matches GW-8308 evidence (valid 60-min session exp)
    const iso = new Date(seconds * 1000).toISOString();
    expect(normalizeExpiryToSeconds(seconds)).toBe(
      normalizeExpiryToSeconds(iso),
    );
  });
});
