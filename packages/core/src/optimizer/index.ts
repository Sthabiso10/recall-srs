/**
 * @recall-srs/core/optimizer — fit FSRS weights to a learner's history.
 *
 * A separate entry point on purpose. Optimisation is a batch job run
 * occasionally, not something a study screen does, and most apps should never
 * ship this code to a browser. Importing `@recall-srs/core` does not pull it in.
 *
 *   import { optimizeFSRSWeights } from '@recall-srs/core/optimizer';
 *
 *   const result = await optimizeFSRSWeights(await adapter.listReviews());
 *   if (result.recommendation === 'adopt') {
 *     await saveWeightsForUser(userId, result.weights);
 *   } else {
 *     console.log(result.reason); // safe to show the user
 *   }
 */

export type { EvaluationResult } from './loss';
export { computeLogLoss, evaluateWeights } from './loss';

export type { BuildSequencesOptions, TrainingReview, TrainingSequence } from './sequences';
export { buildTrainingSequences, countPredictableReviews, splitSequences } from './sequences';

export {
  FSRS_WEIGHT_BOUNDS,
  clampWeights,
  denormalizeWeights,
  normalizeWeights,
  weightsInBounds,
} from './bounds';

export type { OptimizeOptions, OptimizeProgress, OptimizeResult } from './optimize';
export { optimizeFSRSWeights } from './optimize';
