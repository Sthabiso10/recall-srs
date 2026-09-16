/**
 * ID generation with zero dependencies.
 *
 * Prefers `crypto.randomUUID` (Node 19+, all modern browsers, React Native via
 * polyfill) and degrades to a timestamp+random id so the library never throws
 * in an old WebView. IDs are opaque strings everywhere — if you want ULIDs or
 * database-generated keys, pass your own `id` to `createCard`/`createDeck`.
 */

export function createId(prefix?: string): string {
  const raw = randomUuid();
  return prefix ? `${prefix}_${raw}` : raw;
}

/** Structural, not `lib.dom`'s `Crypto` — the core compiles without the DOM lib. */
type CryptoLike = { randomUUID?: () => string };

function randomUuid(): string {
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  // Fallback: not RFC-4122 compliant, but collision-safe enough for client IDs.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
