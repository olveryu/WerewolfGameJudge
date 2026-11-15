export const SUBMISSION_BATCH_ORIGIN_STATE = {
  adminSubmissionBatchOrigin: 'library',
} as const;

export function isSubmissionBatchOpenedFromLibrary(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    Reflect.get(state, 'adminSubmissionBatchOrigin') === 'library'
  );
}
