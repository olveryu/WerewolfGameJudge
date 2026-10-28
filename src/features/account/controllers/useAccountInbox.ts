/**
 * Mounts the account inbox consumer for the signed-in user: decodes settlement events,
 * refreshes growth queries and shows the reward toast before each batch is acknowledged.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner-native';

import { useServices } from '@/contexts/ServiceContext';
import {
  type AccountSettlementEvent,
  parseAccountEvent,
} from '@/features/account/model/accountEvent';
import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import { gachaStatusOptions } from '@/features/gacha/queries/gachaQueryOptions';
import { platformEnvironment } from '@/platform/env/PlatformEnvironment';
import { apiClient } from '@/platform/http/client';
import { AccountInbox, type AccountInboxEvent } from '@/platform/inbox/AccountInbox';
import { handleError } from '@/utils/errorPipeline';
import { gameRoomLog } from '@/utils/logger';

const SETTLE_TOAST_DURATION_MS = 10_000;

function showSettleToast(result: AccountSettlementEvent): void {
  const leveledUp = result.newLevel > result.previousLevel;
  gameRoomLog.debug('Settle toast', { xpEarned: result.xpEarned, leveledUp });
  const description = `+${result.xpEarned} 经验 · ${result.normalDrawsEarned} 普通抽 · ${result.goldenDrawsEarned} 黄金抽`;
  if (leveledUp) {
    toast.success(`升级 Lv.${result.newLevel}！`, {
      description,
      duration: SETTLE_TOAST_DURATION_MS,
    });
  } else {
    toast.info(result.xpEarned === 0 ? 'MVP 奖励到账' : '对局奖励到账', {
      description,
      duration: SETTLE_TOAST_DURATION_MS,
    });
  }
}

/**
 * Decode one inbox event. An undecodable event is reported loudly and dead-lettered (returns
 * null; the batch is still acknowledged) so one poison event never blocks later notifications.
 */
function decodeAccountEvent(event: AccountInboxEvent): AccountSettlementEvent | null {
  try {
    const result = parseAccountEvent(event.message);
    if (result.eventId !== event.eventId) {
      throw new Error(
        `Account event identity mismatch (envelope: ${event.eventId}, message: ${result.eventId})`,
      );
    }
    return result;
  } catch (error) {
    handleError(
      new Error(
        `Undecodable account event dead-lettered (eventId: ${event.eventId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
      { label: '丢弃无法解码的结算通知', logger: gameRoomLog, feedback: false },
    );
    return null;
  }
}

export function useAccountInbox(): void {
  const queryClient = useQueryClient();
  const { authService, inboxWakes } = useServices();

  useEffect(() => {
    const inbox = new AccountInbox({
      api: apiClient,
      environment: platformEnvironment,
      wakes: inboxWakes,
      auth: authService,
      deliver: async (session, events, signal) => {
        const decoded = events.map(decodeAccountEvent).filter((event) => event !== null);
        if (decoded.length === 0) return;
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: gachaStatusOptions(session.userId).queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: userStatsOptions(session.userId).queryKey,
          }),
        ]);
        if (signal.aborted) return;
        for (const event of decoded) showSettleToast(event);
      },
      onError: (error) =>
        handleError(error, {
          label: '读取结算通知',
          logger: gameRoomLog,
          feedback: 'toast',
          expectedCodes: [401, 403, 429],
          alertMessage: '结算通知读取失败，稍后重试',
        }),
    });
    inbox.start();
    return () => inbox.stop();
  }, [authService, inboxWakes, queryClient]);
}
