'use client';

/**
 * `useProgress()` — the numbers behind `<ProgressDashboard>`.
 *
 * Reads cards from the provider and review history from the adapter, then hands
 * both to the pure stat functions in `@recall-srs/core`. Nothing is computed here
 * that could be computed (and tested) in the core.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeDeckStats,
  computeForecast,
  computeRetentionCurve,
  type DeckStats,
  type ForecastPoint,
  type RetentionPoint,
  type ReviewLog,
} from '@recall-srs/core';
import { useSRSContext } from '../context/SRSProvider';

export interface UseProgressOptions {
  /** Days of forecast to compute. Default 30. */
  forecastDays?: number;
  /** Only count reviews at or after this timestamp. Default: all history. */
  since?: number;
}

export interface UseProgressResult {
  stats: DeckStats | null;
  forecast: ForecastPoint[];
  retention: RetentionPoint[];
  reviews: ReviewLog[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProgress({
  forecastDays = 30,
  since,
}: UseProgressOptions = {}): UseProgressResult {
  const { adapter, cards, deckId } = useSRSContext();

  const [reviews, setReviews] = useState<ReviewLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Review history grows without bound. Once a deck has months of data,
      // move this aggregation server-side (a materialised view, or a stats
      // endpoint) rather than shipping every log to the browser.
      const logs = await adapter.listReviews({
        ...(deckId ? { deckId } : {}),
        ...(since ? { since } : {}),
      });
      setReviews(logs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [adapter, deckId, since]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const cardList = useMemo(() => Array.from(cards.values()), [cards]);

  const stats = useMemo(
    () => (cardList.length === 0 ? null : computeDeckStats(cardList, reviews)),
    [cardList, reviews],
  );

  const forecast = useMemo(
    () => computeForecast(cardList, forecastDays),
    [cardList, forecastDays],
  );

  const retention = useMemo(() => computeRetentionCurve(reviews), [reviews]);

  return { stats, forecast, retention, reviews, loading, error, refresh: loadReviews };
}
