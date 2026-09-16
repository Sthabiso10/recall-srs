'use client';

/**
 * `<ProgressDashboard>` — retention, workload and streaks.
 *
 * Same two-layer approach as `<StudyView>`: pass a render prop for full
 * control, or take the default unstyled markup with `data-*` hooks.
 *
 * The default charts are deliberately dependency-free (inline SVG bars). Recall
 * will not pull Recharts or D3 into your bundle for a bar chart — if you want
 * richer visuals, use the render prop and bring your own chart library.
 */

import type { ReactNode } from 'react';
import type { DeckStats, ForecastPoint, RetentionPoint } from '@recall-srs/core';
import { useProgress } from '../hooks/useProgress';
import { useRecallIntl } from '../context/RecallIntl';

export interface ProgressDashboardRenderProps {
  stats: DeckStats | null;
  forecast: ForecastPoint[];
  retention: RetentionPoint[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export interface ProgressDashboardProps {
  /** Days of workload forecast to show. Default 30. */
  forecastDays?: number;
  children?: (props: ProgressDashboardRenderProps) => ReactNode;
  className?: string;
  loadingState?: ReactNode;
  /** Hide the built-in forecast chart (e.g. you render your own). */
  showForecast?: boolean;
  showRetention?: boolean;
}

export function ProgressDashboard({
  forecastDays = 30,
  children,
  className,
  loadingState,
  showForecast = true,
  showRetention = true,
}: ProgressDashboardProps) {
  const intl = useRecallIntl();
  const { stats, forecast, retention, loading, error, refresh } = useProgress({
    forecastDays,
  });

  if (children) {
    return <>{children({ stats, forecast, retention, loading, error, refresh })}</>;
  }

  if (loading) {
    return <div data-recall-dashboard="" data-state="loading">{loadingState ?? intl.strings.loading}</div>;
  }

  if (error) {
    return (
      <div data-recall-dashboard="" data-state="error" role="alert">
        <p>{intl.strings.couldNotLoad}</p>
        <button type="button" onClick={() => void refresh()}>
          {intl.strings.retry}
        </button>
      </div>
    );
  }

  return (
    <div data-recall-dashboard="" className={className}>
      <dl data-recall-stats="">
        <Stat label={intl.strings.stats.dueNow} value={intl.format.number(stats?.dueNow ?? 0)} />
        <Stat label={intl.strings.stats.dueToday} value={intl.format.number(stats?.dueToday ?? 0)} />
        <Stat label={intl.strings.stats.totalCards} value={intl.format.number(stats?.total ?? 0)} />
        <Stat label={intl.strings.stats.retention} value={intl.format.percent(stats?.retentionRate ?? 0)} />
        <Stat label={intl.strings.stats.streak} value={intl.format.interval(stats?.streakDays ?? 0)} />
      </dl>

      {showForecast ? <ForecastChart points={forecast} /> : null}

      {/* Empty until `computeRetentionCurve` is implemented in the core. */}
      {showRetention && retention.length > 0 ? (
        <RetentionChart points={retention} />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div data-recall-stat="">
      <dt data-recall-stat-label="">{label}</dt>
      <dd data-recall-stat-value="">{value}</dd>
    </div>
  );
}

/**
 * Upcoming workload, as inline SVG bars.
 *
 * Bars are sized as percentages of the busiest day so the chart scales to any
 * container without measuring the DOM.
 */
function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.dueCount));

  return (
    <div data-recall-forecast="" role="img" aria-label="Cards due over the coming days">
      {points.map((point) => (
        <div
          key={point.dayOffset}
          data-recall-forecast-bar=""
          data-day={point.dayOffset}
          title={`${point.dueCount} due in ${point.dayOffset} day(s)`}
          style={{ height: `${(point.dueCount / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function RetentionChart({ points }: { points: RetentionPoint[] }) {
  const intl = useRecallIntl();
  return (
    <div data-recall-retention="" role="img" aria-label="Retention by interval length">
      {points.map((point) => (
        <div
          key={point.intervalDays}
          data-recall-retention-bar=""
          title={`${intl.format.percent(point.retention)} at ${intl.format.interval(point.intervalDays)} (${point.reviewCount})`}
          style={{ height: `${point.retention * 100}%` }}
        />
      ))}
    </div>
  );
}
