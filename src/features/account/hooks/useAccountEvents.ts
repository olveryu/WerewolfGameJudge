/**
 * Account-owned inbox consumer, independent of the active game or room.
 * Refreshes growth data and presents settlement notifications before HTTP acknowledgement.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { useServices } from '@/contexts/ServiceContext';
import {
  type AccountSettlementEvent,
  parseAccountEvent,
} from '@/features/account/model/accountEvent';
import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import { gachaStatusOptions } from '@/features/gacha/queries/gachaQueryOptions';
import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';
import { appVisibilityStore } from '@/services/infra/appVisibility';
import type { AuthSession } from '@/services/types/IAuthService';
import { handleError } from '@/utils/errorPipeline';
import { gameRoomLog } from '@/utils/logger';

const ACCOUNT_EVENT_POLL_MS = 30_000;
const accountEventResponseSchema = z.strictObject({
  event: z.strictObject({ eventId: z.string().min(1), message: z.unknown() }).nullable(),
});
const acknowledgementSchema = z.strictObject({ success: z.literal(true) });

function showSettleToast(result: AccountSettlementEvent): void {
  const leveledUp = result.newLevel > result.previousLevel;
  gameRoomLog.debug('Settle toast', { xpEarned: result.xpEarned, leveledUp });
  const description = `+${result.xpEarned} 经验 · ${result.normalDrawsEarned} 普通抽 · ${result.goldenDrawsEarned} 黄金抽`;
  if (leveledUp) {
    toast.success(`升级 Lv.${result.newLevel}！`, {
      description,
      duration: 10000,
    });
  } else {
    toast.info(result.xpEarned === 0 ? 'MVP 奖励到账' : '对局奖励到账', {
      description,
      duration: 10000,
    });
  }
}

/**
 * Consume authenticated account events while visible; cancel on identity or visibility changes.
 */
export function useAccountEvents(): void {
  const queryClient = useQueryClient();
  const { authService } = useServices();

  useEffect(() => {
    let session: AuthSession | null = null;
    let lastDeliveredEventId: string | null = null;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      controller?.abort();
      controller = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const start = () => {
      stop();
      const currentSession = authService.getAuthSession();
      if (currentSession !== session) lastDeliveredEventId = null;
      session = currentSession;
      if (currentSession === null || !appVisibilityStore.getSnapshot()) return;
      const currentController = new AbortController();
      controller = currentController;
      const { signal } = currentController;
      const assertActive = () => {
        signal.throwIfAborted();
        if (authService.getAuthSession() !== currentSession) {
          throw new DOMException('Authentication changed', 'AbortError');
        }
      };
      const poll = async () => {
        try {
          while (!signal.aborted) {
            assertActive();
            const { event } = await cfGet(
              '/api/user/events/next',
              (value) => accountEventResponseSchema.parse(value),
              { signal },
            );
            assertActive();
            if (event === null) break;
            const result = parseAccountEvent(event.message);
            if (result.eventId !== event.eventId)
              throw new Error('Account event identity mismatch');
            if (lastDeliveredEventId !== event.eventId) {
              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: gachaStatusOptions(currentSession.userId).queryKey,
                }),
                queryClient.invalidateQueries({
                  queryKey: userStatsOptions(currentSession.userId).queryKey,
                }),
              ]);
              assertActive();
              showSettleToast(result);
              lastDeliveredEventId = event.eventId;
            }
            assertActive();
            await cfPost(
              `/api/user/events/${encodeURIComponent(event.eventId)}/ack`,
              undefined,
              (value) => acknowledgementSchema.parse(value),
              { signal },
            );
          }
        } catch (error) {
          handleError(error, {
            label: '读取结算通知',
            logger: gameRoomLog,
            feedback: 'toast',
            expectedCodes: [401, 403, 429],
            alertMessage: '结算通知读取失败，稍后自动重试',
          });
        } finally {
          if (!signal.aborted)
            timer = setTimeout(() => {
              void poll();
            }, ACCOUNT_EVENT_POLL_MS);
        }
      };
      void poll();
    };
    const unsubscribeAuth = authService.subscribeAuth(start);
    const unsubscribeVisibility = appVisibilityStore.subscribe(start);
    start();
    return () => {
      unsubscribeAuth();
      unsubscribeVisibility();
      stop();
    };
  }, [authService, queryClient]);
}
