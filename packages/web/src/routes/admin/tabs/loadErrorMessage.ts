/** The message an admin tab shows for a failed load. */
export function loadErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unknown error';
}
