/**
 * useWerewolfHostFlow — the host's lifecycle commands behind their
 * confirm dialogs: deal, start, abort, redeal, return to lobby, bot
 * shortcuts, MVP selection.
 *
 * Every command goes through the shared single-flight `submit`; the
 * dialogs only gate intent. Audio teardown (stop narration, drop the
 * preloaded clips) happens on the host device for the three resets, and
 * the narration clips preload once the game begins.
 */

import {
  type GameState,
  GameStatus,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { isBotOccupant } from '@game-judge/game-engine/platform/room/seating/roster';
import { getMvpGoldenDraws } from '@game-judge/game-engine/product/rewards';
import { useCallback, useState } from 'react';

import { HOST_FLOW_CONFIRM } from '@/features/room/model/hostManagementActions';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfSubmit } from '@/games/werewolf/model/WerewolfRoomSession';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';

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
  /** Exports the shared review image; the Ended flows offer it before leaving. */
  readonly shareReview: () => Promise<void>;
}

const ASSIGN_CONFIRM_TEXT = '所有座位已满，将洗牌并分配角色';
const START_CONFIRM_TITLE = '开始游戏？';
const START_CONFIRM_TEXT = '请将手机音量调到最大';
const ABORT_CONFIRM_TEXT = '本局不计胜负，保留座位和板子，清除已分配的角色。';
const ENDED_FLOW_TEXT = '本局复盘将无法查看，是否先分享战报？';

export function useWerewolfHostFlow(input: UseWerewolfHostFlowInput): WerewolfHostFlow {
  const { state, submit, audio, shareReview } = input;
  const roleRevealRandomNonce = state.roleRevealRandomNonce ?? null;
  // The picker belongs to the deal it opened in: a new deal is a new game and closes it.
  const [mvpOpenNonce, setMvpOpenNonce] = useState<{ readonly nonce: string | null } | null>(null);
  const isMvpOpen = mvpOpenNonce !== null && mvpOpenNonce.nonce === roleRevealRandomNonce;

  const resetAudioThenSubmit = useCallback(
    async (label: string, command: WerewolfPublicCommand) => {
      audio.stopNarration();
      audio.clearPreloaded();
      await submit(label, command);
    },
    [audio, submit],
  );

  const startGame = useCallback(async () => {
    const ok = await submit('开始游戏', { type: 'werewolf.game.begin' });
    if (ok) audio.preloadRoles(state.templateRoles);
  }, [audio, state.templateRoles, submit]);

  const showEndedFlowDialog = useCallback(
    (flow: 'redeal' | 'returnToLobby') => {
      const isRedeal = flow === 'redeal';
      showAlert(
        isRedeal ? HOST_FLOW_CONFIRM.nextRoundTitle : HOST_FLOW_CONFIRM.returnLobbyTitle,
        ENDED_FLOW_TEXT,
        [
          CANCEL_BUTTON,
          { text: '分享战报', onPress: () => void shareReview() },
          {
            text: isRedeal ? '再来一局' : '返回大厅',
            onPress: () =>
              isRedeal
                ? resetAudioThenSubmit('再来一局', { type: 'werewolf.game.redeal' })
                : resetAudioThenSubmit('返回大厅', { type: 'werewolf.game.returnToLobby' }),
          },
        ],
      );
    },
    [resetAudioThenSubmit, shareReview],
  );

  const onHostControl = useCallback(
    (action: WerewolfHostControlAction) => {
      switch (action) {
        case 'prepareToFlip':
          showConfirmAlert(HOST_FLOW_CONFIRM.assignTitle, ASSIGN_CONFIRM_TEXT, async () => {
            await submit('分配角色', { type: 'werewolf.roles.assign' });
          });
          return;
        case 'startGame':
          showConfirmAlert(START_CONFIRM_TITLE, START_CONFIRM_TEXT, startGame);
          return;
        case 'abort':
          showConfirmAlert(HOST_FLOW_CONFIRM.abortTitle, ABORT_CONFIRM_TEXT, () =>
            resetAudioThenSubmit('中止本局', { type: 'werewolf.game.abort' }),
          );
          return;
        case 'redeal':
          showEndedFlowDialog('redeal');
          return;
        case 'returnToLobby':
          showEndedFlowDialog('returnToLobby');
          return;
      }
    },
    [resetAudioThenSubmit, showEndedFlowDialog, startGame, submit],
  );

  const markAllBotsViewed = useCallback(() => {
    void submit('机器人查看身份', { type: 'werewolf.bots.markAllBotsViewed' });
  }, [submit]);

  const markAllBotsGroupConfirmed = useCallback(() => {
    void submit('机器人确认', { type: 'werewolf.groupConfirm.ackBots' });
  }, [submit]);

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
          { durable: true },
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
