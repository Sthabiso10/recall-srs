/**
 * The playground's two privileged operations: wipe, and travel through time.
 *
 * Both reach past the `StorageAdapter` and rewrite its localStorage blob
 * directly, which an application should never do. They live here, together,
 * with this warning, rather than being scattered through the UI.
 *
 * Why they are not adapter methods:
 *
 *   1. "delete everything" is deliberately absent from `StorageAdapter`. A
 *      backend that can nuke a learner's history in one call is a backend
 *      that eventually will.
 *   2. Review logs are append-only by contract. Shifting `reviewedAt` is
 *      rewriting history, which is exactly what no real app may do.
 *
 * A demo needs both anyway, so it opens the box knowingly.
 *
 * ── On travelling ───────────────────────────────────────────────────────
 *
 * The honest way to fast-forward would be to inject a clock: the core exports
 * `offsetClock` for precisely this and every scheduling function takes an
 * optional `now`. But `<SRSProvider>` has no clock prop yet, so the playground
 * does the equivalent transformation on the data instead. Every stored
 * timestamp moves *back* by N days, which is indistinguishable from moving
 * "now" forward by N, because FSRS only ever reads elapsed time (now minus
 * `lastReviewedAt`) and due-ness (now versus `dueAt`). Both differences are
 * preserved exactly under a uniform shift.
 */

const DAY_MS = 86_400_000;
const SCHEMA_VERSION = 1;

/** Mirrors the adapter's internal snapshot. Kept loose: this is a foreign shape. */
interface LooseSnapshot {
  version?: number;
  cards?: Record<string, LooseCard>;
  decks?: Record<string, unknown>;
  reviews?: LooseReview[];
}

interface LooseCard {
  createdAt?: number;
  updatedAt?: number;
  scheduling?: { dueAt?: number; lastReviewedAt?: number | null };
}

interface LooseReview {
  reviewedAt?: number;
}

function keyFor(namespace: string): string {
  return `${namespace}:v${SCHEMA_VERSION}`;
}

/** Drop everything the playground has stored. Returns false if storage is blocked. */
export function wipeDemoData(namespace: string): boolean {
  try {
    window.localStorage.removeItem(keyFor(namespace));
    return true;
  } catch {
    // Private mode, or a browser with site data switched off. Nothing to wipe.
    return false;
  }
}

/**
 * Move every stored timestamp back by `days`, so the next read sees a world
 * `days` further on. Returns false if there was nothing to shift.
 */
export function travelForward(namespace: string, days: number): boolean {
  if (days <= 0) return false;
  const shift = days * DAY_MS;

  try {
    const raw = window.localStorage.getItem(keyFor(namespace));
    if (!raw) return false;

    const snapshot = JSON.parse(raw) as LooseSnapshot;

    for (const card of Object.values(snapshot.cards ?? {})) {
      if (typeof card.createdAt === 'number') card.createdAt -= shift;
      if (typeof card.updatedAt === 'number') card.updatedAt -= shift;
      const scheduling = card.scheduling;
      if (!scheduling) continue;
      if (typeof scheduling.dueAt === 'number') scheduling.dueAt -= shift;
      if (typeof scheduling.lastReviewedAt === 'number') {
        scheduling.lastReviewedAt -= shift;
      }
    }

    for (const review of snapshot.reviews ?? []) {
      if (typeof review.reviewedAt === 'number') review.reviewedAt -= shift;
    }

    window.localStorage.setItem(keyFor(namespace), JSON.stringify(snapshot));
    return true;
  } catch {
    // Corrupt or unwritable. The caller reloads from storage either way, so
    // the worst case is a button that appears to do nothing.
    return false;
  }
}
