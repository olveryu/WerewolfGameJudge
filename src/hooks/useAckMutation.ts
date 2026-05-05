/**
 * useAckMutation — TanStack Query mutation wrapper for server-ack roundtrips.
 *
 * Each protocol ack (reveal, hunterStatus, groupConfirm, ...) registers a
 * mutation under `mutationKey: ['ack', name]`. While the mutation is pending,
 * `useIsMutating({ mutationKey: ['ack'] })` reports the in-flight count
 * (see usePendingAcks).
 *
 * The mutation lifecycle replaces the previous `pendingX` boolean state:
 * - mutate() called → isPending=true (synchronous)
 * - HTTP resolved → isPending=false
 *
 * Retry policy is 0 — UI layer decides whether to re-show the dialog on
 * failure. Auto-retry would be invisible to the user; we want explicit retry.
 */

import { useMutation } from '@tanstack/react-query';

type AckName = 'reveal' | 'hunterStatus' | 'groupConfirm';

export function useAckMutation<TArgs, TData>(
  name: AckName,
  mutationFn: (args: TArgs) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, args: TArgs) => void;
    onError?: (error: Error, args: TArgs) => void;
  },
) {
  return useMutation<TData, Error, TArgs>({
    mutationKey: ['ack', name],
    mutationFn,
    retry: 0,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}
