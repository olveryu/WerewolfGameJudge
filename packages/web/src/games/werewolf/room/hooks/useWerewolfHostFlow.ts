/**
 * useWerewolfHostFlow — the host's lifecycle commands behind their
 * confirm dialogs: deal, start, restart, bot shortcuts, MVP selection.
 *
 * Every command goes through the shared single-flight `submit`; the
 * dialogs only gate intent. A successful restart tears down the host's
 * narration and preloaded clips.
 * Narration preparation belongs to the audio orchestration, not host commands.
 */

import {
  type GameState,
  GameStatus,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { isBotOccupant } from '@game-judge/game-engine/platform/room/seating/roster';
import { getMvpGoldenDraws } from '@game-judge/game-engine/product/rewards';
import { useCallback, useState } from 'react';

import { HOST_ACTION_KEYS, HOST_FLOW_CONFIRM } from '@/features/room/model/hostManagementActions';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfSubmit } from '@/games/werewolf/model/WerewolfRoomSession';
import { showConfirmAlert, showDestructiveAlert, showDismissAlert } from '@/utils/alertPresets';

import type { WerewolfHostControlAction } from '../createWerewolfHostManagement';

interface MvpParticipant {
  readonly userId: string;
  readonly seat: number;
  readonly displayName: string;
  readonly hasLeft: boolean;
}

export interface MvpSelection {
  readonly participants: readonly MvpParticipant[];
  readonly goldenDraws: number;
  readonly onSelect: (userId: string) => Promise<void>;
}

interface WerewolfHostFlow {
  readonly onHostControl: (action: WerewolfHostControlAction) => void;
  readonly markAllBotsViewed: () => void;
  readonly markAllBotsGroupConfirmed: () => void;
  /** The MVP picker while open at Ended with no MVP yet; null otherwise. */
  readonly mvpSelection: MvpSelection | null;
  readonly openMvpSelection: () => void;
  readonly closeMvpSelection: () => void;
}

interface UseWerewolfHostFlowInput {
  readonly state: GameState;
  readonly submit: WerewolfSubmit;
  readonly audio: WerewolfAudioRuntime;
}

const ASSIGN_CONFIRM_TEXT = '所有座位已满，将洗牌并分配角色';
const START_CONFIRM_TITLE = '开始游戏？';
const START_CONFIRM_TEXT = '请将手机音量调到最大';

/** Manage the host's game commands and MVP selection. */
export function useWerewolfHostFlow(input: UseWerewolfHostFlowInput): WerewolfHostFlow {
  const { state, submit, audio } = input;
  const roleRevealRandomNonce = state.roleRevealRandomNonce ?? null;
  // The picker belongs to the deal it opened in: a new deal is a new game and closes it.
  const [mvpOpenNonce, setMvpOpenNonce] = useState<{ readonly nonce: string | null } | null>(null);
  const isMvpOpen = mvpOpenNonce !== null && mvpOpenNonce.nonce === roleRevealRandomNonce;

  const resetAudioThenSubmit = useCallback(
    async (label: string, command: WerewolfPublicCommand, actionKey: string) => {
      const succeeded = await submit(label, command, { actionKey });
      if (succeeded) {
        audio.stopNarration();
        audio.clearPreloaded();
      }
    },
    [audio, submit],
  );

  const onHostControl = useCallback(
    (action: WerewolfHostControlAction) => {
      switch (action) {
        case 'prepareToFlip':
          showConfirmAlert(HOST_FLOW_CONFIRM.assignTitle, ASSIGN_CONFIRM_TEXT, async () => {
            await submit(
              '分配角色',
              { type: 'werewolf.roles.assign' },
              { actionKey: HOST_ACTION_KEYS.assignRoles },
            );
          });
          return;
        case 'startGame':
          showConfirmAlert(START_CONFIRM_TITLE, START_CONFIRM_TEXT, async () => {
            await submit(
              '开始游戏',
              { type: 'werewolf.game.begin' },
              { actionKey: HOST_ACTION_KEYS.startGame },
            );
          });
          return;
        case 'restart':
          showDestructiveAlert(
            '重新开始？',
            state.status === GameStatus.Ended
              ? state.lastNightInfoConfirmed !== true
                ? '你尚未确认昨夜信息。重新开始将清除本局并保留座位和板子，之后可能无法查看复盘；本局已结算，奖励不会撤销。'
                : !(state.nightReviewAllowedSeats ?? []).some(
                      (seat) => state.roster[seat] !== undefined,
                    )
                  ? '你尚未授权玩家查看复盘。重新开始将清除本局并保留座位和板子，之后可能无法查看复盘；本局已结算，奖励不会撤销。'
                  : !(state.reviewCompletedUserIds ?? []).includes(state.hostUserId)
                    ? '你尚未查看本局复盘。重新开始将清除本局并保留座位和板子，之后可能无法查看复盘；本局已结算，奖励不会撤销。'
                    : '保留座位和板子，清除本局并回到准备。之后可能无法查看复盘；本局已结算，奖励不会撤销。'
              : '保留座位和板子，清除本局并回到准备。本局中止，不结算完成奖励。',
            '重新开始',
            () =>
              resetAudioThenSubmit(
                '重新开始',
                {
                  type: 'werewolf.game.restart',
                  gameSequence: state.gameSequence,
                  wasEnded: state.status === GameStatus.Ended,
                },
                HOST_ACTION_KEYS.restart,
              ),
          );
          return;
      }
    },
    [resetAudioThenSubmit, state, submit],
  );

  const markAllBotsViewed = useCallback(() => {
    showConfirmAlert('标记机器人已查看？', '将标记所有未查看身份的机器人。', async () => {
      await submit(
        '机器人查看身份',
        { type: 'werewolf.bots.markAllBotsViewed' },
        { actionKey: HOST_ACTION_KEYS.markBotsViewed },
      );
    });
  }, [submit]);

  const markAllBotsGroupConfirmed = useMarkAllBotsGroupConfirmed(state, submit);

  const canSelectMvp = state.status === GameStatus.Ended && state.mvpUserId === undefined;

  const openMvpSelection = useCallback(() => {
    if (!canSelectMvp) throw new Error('[FAIL-FAST] MVP selection opened outside Ended');
    if (state.startingParticipants === undefined) {
      showDismissAlert('无法评选 MVP', '本局缺少开局真人名单');
      return;
    }
    setMvpOpenNonce({ nonce: roleRevealRandomNonce });
  }, [canSelectMvp, roleRevealRandomNonce, state.startingParticipants]);

  const closeMvpSelection = useCallback(() => setMvpOpenNonce(null), []);

  const mvpSelection = ((): MvpSelection | null => {
    if (!isMvpOpen || !canSelectMvp) return null;
    const participants = state.startingParticipants;
    if (participants === undefined) {
      throw new Error('[FAIL-FAST] MVP selection is open without a starting roster');
    }
    return {
      participants: participants.map((participant) => {
        const occupant = state.roster[participant.seat];
        const isStillSeated =
          occupant != null && !isBotOccupant(occupant) && occupant.userId === participant.userId;
        return {
          ...participant,
          displayName: isStillSeated ? occupant.profile.displayName : '',
          hasLeft: !isStillSeated,
        };
      }),
      goldenDraws: getMvpGoldenDraws(participants.length),
      onSelect: async (mvpUserId) => {
        // One-shot per deal (pinned by roleRevealRandomNonce): durable so a
        // dropped connection replays it instead of losing the pick.
        const ok = await submit(
          '评选 MVP',
          { type: 'werewolf.mvp.select', selection: { roleRevealRandomNonce, mvpUserId } },
          { durable: true, actionKey: 'select-mvp' },
        );
        if (ok) setMvpOpenNonce(null);
      },
    };
  })();

  return {
    onHostControl,
    markAllBotsViewed,
    markAllBotsGroupConfirmed,
    mvpSelection,
    openMvpSelection,
    closeMvpSelection,
  };
}

function useMarkAllBotsGroupConfirmed(state: GameState, submit: WerewolfSubmit): () => void {
  const gameSequence = state.gameSequence;
  const currentStep = state.nightState?.slice.current;
  return useCallback(() => {
    if (currentStep === null || currentStep === undefined) {
      throw new Error('[FAIL-FAST] Bot acknowledgement without a current step');
    }
    showConfirmAlert('标记机器人已确认？', '将为本阶段的机器人确认信息。', async () => {
      await submit(
        '机器人确认',
        {
          type: 'werewolf.step.ackBots',
          gameSequence,
          stepId: currentStep.stepId,
          serial: currentStep.serial,
        },
        {
          actionKey: 'mark-bots-confirmed',
        },
      );
    });
  }, [currentStep, gameSequence, submit]);
}
