/**
 * @recall-srs/core — the public API surface.
 *
 * Anything not re-exported here is internal and may change in a patch release.
 * Keep this file curated: it *is* the API contract, and the easiest way to end
 * up with an accidental public API is `export * from './everything'`.
 */

/* ---- types (the contract every package speaks) ---------------------- */
export type {
  Card,
  CardId,
  CardStatus,
  DeckId,
  DeckSettings,
  Difficulty,
  ForecastPoint,
  DeckStats,
  MemoryState,
  NewCard,
  NewDeck,
  RecallQuality,
  RetentionPoint,
  ReviewLog,
  ReviewLogId,
  SchedulingSnapshot,
  SchedulingState,
  SessionConfig,
  SessionId,
  SessionSummary,
  StudyDeck,
  StudySessionState,
  Timestamp,
} from './types/index';
export { PASSING_QUALITY } from './types/index';

/* ---- domain --------------------------------------------------------- */
export type { LeechPolicy } from './domain/card';
export {
  DEFAULT_LEECH_POLICY,
  applyLeechPolicy,
  createCard,
  freshSchedulingState,
  hasTag,
  indexCards,
  isLeech,
  matchesAnyTag,
  resetCard,
  suspendCard,
  unsuspendCard,
} from './domain/card';
export { createDeck, resolveDeckSettings } from './domain/deck';

/* ---- algorithm: the shared contract ---------------------------------- */
export type {
  GradeOptions,
  GradeResult,
  SchedulePreview,
  Scheduler,
} from './algorithm/types';

/* ---- algorithm: SM-2 ------------------------------------------------- */
export type { SchedulerConfig } from './algorithm/constants';
export { DEFAULT_DECK_SETTINGS, DEFAULT_SCHEDULER_CONFIG } from './algorithm/constants';
export { applySM2, nextEaseFactor, nextInterval } from './algorithm/sm2';
export { createScheduler } from './algorithm/scheduler';
export { NotImplementedError, SM2_IMPLEMENTED } from './algorithm/sm2';

/* ---- algorithm: FSRS ------------------------------------------------- */
export type { FSRSConfig, FSRSRating } from './algorithm/fsrs-params';
export {
  DEFAULT_FSRS_CONFIG,
  FSRS_5_DEFAULT_DECAY,
  FSRS_5_DEFAULT_WEIGHTS,
  FSRS_5_WEIGHT_COUNT,
  FSRS_6_DEFAULT_DECAY,
  FSRS_6_DEFAULT_WEIGHTS,
  FSRS_6_WEIGHT_COUNT,
  FSRS_AGAIN,
  FSRS_DECAY,
  FSRS_EASY,
  FSRS_FACTOR,
  FSRS_GOOD,
  FSRS_HARD,
  FSRS_MAX_DIFFICULTY,
  FSRS_MAX_INITIAL_STABILITY,
  FSRS_MAX_STABILITY,
  FSRS_MIN_DIFFICULTY,
  FSRS_MIN_STABILITY,
  FSRS_WEIGHT_BOUNDS,
  decayFactorFor,
  migrateWeights,
  validateFSRSConfig,
} from './algorithm/fsrs-params';
export type { FuzzRange } from './algorithm/fuzz';
export {
  FUZZ_MIN_INTERVAL_DAYS,
  fuzzIntervalBanded,
  fuzzIntervalByRatio,
  getFuzzRange,
} from './algorithm/fuzz';
export {
  applyFSRS,
  initialDifficulty,
  initialStability,
  intervalForRetention,
  nextDifficulty,
  retrievability,
  stabilityAfterLapse,
  stabilityAfterRecall,
  stabilityShortTerm,
  toFSRSRating,
} from './algorithm/fsrs';
export type { FSRSScheduler } from './algorithm/fsrs-scheduler';
export { createFSRSScheduler, fsrsScheduler } from './algorithm/fsrs-scheduler';

/* ---- session -------------------------------------------------------- */
export type { BuildQueueOptions } from './session/queue';
export { buildQueue } from './session/queue';
export type { StudySession, StudySessionOptions } from './session/study-session';
export { createStudySession, resumeStudySession } from './session/study-session';

/* ---- statistics ----------------------------------------------------- */
export type {
  DeckStatsOptions,
  LoadBalanceMove,
  LoadBalanceOptions,
  RetentionOptions,
} from './stats/index';
export {
  computeDeckStats,
  computeForecast,
  applyLoadBalance,
  computeLoadBalance,
  computeRetentionCurve,
  computeStreak,
  summarizeSession,
} from './stats/index';

/* ---- ports (implement these to plug in your own backend) ------------ */
export type { CardQuery, ReviewQuery, StorageAdapter } from './ports/storage';
export { StorageError } from './ports/storage';
export type { Clock } from './ports/clock';
export { fixedClock, offsetClock, systemClock } from './ports/clock';

/* ---- utilities ------------------------------------------------------ */
export {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  addDays,
  addMinutes,
  daysBetween,
  dueAtFor,
  isSameDay,
  startOfDay,
  startOfNextDay,
  startOfStudyDay,
} from './utils/date';
export { createId } from './utils/id';
