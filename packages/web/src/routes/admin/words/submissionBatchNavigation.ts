export const SUBMISSION_BATCH_ORIGIN_STATE = {
  adminSubmissionBatchOrigin: 'list',
} as const;

export function isSubmissionBatchOpenedFromList(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    Reflect.get(state, 'adminSubmissionBatchOrigin') === 'list'
  );
}
