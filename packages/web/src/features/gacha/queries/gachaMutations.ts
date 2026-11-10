/**
 * Gacha asset mutations (draw, shard exchange) and the persisted pending-operation view. Only the
 * lazy gacha pages import this module, so its operation store stays out of start-up.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import {
  type DrawResponse,
  type ExchangeResponse,
  exchangeShard,
  performDraw,
} from '@/features/gacha/services/gachaApi';
import { gachaOperationStore } from '@/features/gacha/services/GachaOperationStore';
import { runGachaOperation } from '@/features/gacha/services/runGachaOperation';
import { showAlert } from '@/utils/alert';
import { gachaLog } from '@/utils/logger';

import { gachaStatusOptions } from './gachaQueryOptions';

/** Performs a draw under the persisted operation; refreshes tickets and the collection on success. */
export function useDrawMutation() {
  const queryClient = useQueryClient();
  const { authService } = useServices();
  const { user } = useAuthContext();

  return useMutation({
    mutationKey: ['gacha', 'draw'],
    onMutate: () => authService.getAuthSession(),
    mutationFn: ({ drawType, count }: { drawType: 'normal' | 'golden'; count: number }) => {
      gachaLog.debug('Draw requested', { drawType, count });
      return runGachaOperation(
        authService,
        user?.id ?? null,
        { operation: 'draw', drawType, count },
        (idempotencyKey) => performDraw(drawType, count, idempotencyKey),
      );
    },
    onSuccess: (data: DrawResponse, { drawType, count }, session) => {
      if (!session || session !== authService.getAuthSession()) return;
      const rarities = data.results.map((result) => result.rarity);
      gachaLog.info('Draw success', { drawType, count, rarities });
      void queryClient.invalidateQueries({ queryKey: gachaStatusOptions(session.userId).queryKey });
      void queryClient.invalidateQueries({ queryKey: userStatsOptions(session.userId).queryKey });
    },
  });
}

/** Exchanges shards for one reward under the persisted operation. */
export function useExchangeShardMutation() {
  const queryClient = useQueryClient();
  const { authService } = useServices();
  const { user } = useAuthContext();

  return useMutation({
    onMutate: () => authService.getAuthSession(),
    mutationFn: (rewardId: string) => {
      gachaLog.debug('Exchange requested', { rewardId });
      return runGachaOperation(
        authService,
        user?.id ?? null,
        { operation: 'exchange', rewardId },
        (idempotencyKey) => exchangeShard(rewardId, idempotencyKey),
      );
    },
    onSuccess: (data: ExchangeResponse, _rewardId, session) => {
      if (!session || session !== authService.getAuthSession()) return;
      gachaLog.info('Exchange success', {
        rewardId: data.rewardId,
        cost: data.cost,
        remainingShards: data.remainingShards,
      });
      void queryClient.invalidateQueries({ queryKey: gachaStatusOptions(session.userId).queryKey });
      void queryClient.invalidateQueries({ queryKey: userStatsOptions(session.userId).queryKey });
    },
  });
}

/** Observes persisted uncertainty so recovery stays available after navigation or reload. */
export function usePendingGachaOperation() {
  const { user } = useAuthContext();
  const { authService } = useServices();
  const queryClient = useQueryClient();
  const serialized = useSyncExternalStore(gachaOperationStore.subscribe, () =>
    user ? gachaOperationStore.readSerialized(user.id) : null,
  );
  const pendingOperation = user ? gachaOperationStore.parse(user.id, serialized) : null;

  /** True when the pending operation may be replayed; an expired one asks the user instead. */
  const confirmRecovery = (): boolean => {
    if (pendingOperation === null) return false;
    if (!gachaOperationStore.isExpired(pendingOperation)) return true;
    const session = authService.getAuthSession();
    showAlert(
      '操作已超过恢复期限',
      `无法确认原操作是否成功，不再重发。请核对余额与收藏，必要时通过反馈提供操作号：${pendingOperation.idempotencyKey}`,
      [
        { text: '保留待核对', style: 'cancel' },
        {
          text: '结束等待',
          onPress: () => {
            if (
              session === null ||
              authService.getAuthSession() !== session ||
              session.userId !== pendingOperation.userId
            ) {
              return;
            }
            gachaLog.warn('Expired operation acknowledged with unknown outcome', {
              operation: pendingOperation,
            });
            gachaOperationStore.complete(pendingOperation);
            void queryClient.invalidateQueries({
              queryKey: gachaStatusOptions(session.userId).queryKey,
            });
            void queryClient.invalidateQueries({
              queryKey: userStatsOptions(session.userId).queryKey,
            });
          },
        },
      ],
    );
    return false;
  };
  return { pendingOperation, confirmRecovery };
}
