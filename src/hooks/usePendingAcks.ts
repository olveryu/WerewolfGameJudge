/**
 * usePendingAcks — true while any protocol ack mutation is in-flight.
 *
 * Aggregates over all mutations registered with `mutationKey: ['ack', ...]`
 * via useAckMutation. RoomInteractionPolicy uses this as a single gate
 * replacing the per-ack boolean flags.
 *
 * Lifetime semantics: covers the entire HTTP roundtrip, including the
 * window after the user dismisses the dialog but before the server confirms
 * — exactly the protocol race window the previous pendingX flags protected.
 */

import { useIsMutating } from '@tanstack/react-query';

/** 任何协议 ack mutation 正在进行时返回 true，用于 RoomInteractionPolicy 门控。 */
export const usePendingAcks = (): boolean => useIsMutating({ mutationKey: ['ack'] }) > 0;
