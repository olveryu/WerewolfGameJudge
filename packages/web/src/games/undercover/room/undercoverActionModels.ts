/** Undercover button availability projected from authoritative phase and explicit local selection. */
import type {
  UndercoverPreparationFailure,
  UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import type { RoomPlayerAction } from '@/features/room/model/RoomAction';
import type { RoomPlayerActionModel } from '@/features/room/model/RoomPlayerActions';
import {
  buildLobbyHostStartMessage,
  buildPreparationFailureMessage,
  buildViewIdentityButton,
  resolveViewIdentityAction,
} from '@/features/room/model/RoomPlayerActions';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import {
  buildViewerReviewBottomButtons,
  type RoomReviewEntry,
} from '@/features/room/review/roomReviewActions';
import { TESTIDS } from '@/testids';

import type { UndercoverRoundControls } from './hooks/useUndercoverRoundControls';

type Controls = UndercoverRoundControls;

/**
 * Why a word preparation failed, in the game's own words — the copy the
 * deleted status ribbon showed every viewer, relocated unchanged.
 * Distinct reasons stay distinct: each one explains a different host
 * remedy (a plain retry vs. allowing repeated pairs).
 */
const UNDERCOVER_PREPARATION_FAILURE_REASONS: Readonly<
  Record<UndercoverPreparationFailure, string>
> = {
  selectionFailed: '词语准备失败',
  inventoryEmpty: '暂无可用词语',
  inventoryExhausted: '该类别的新词已用完',
};

function resolveUndercoverBottomMessage(
  controls: Controls,
  state: UndercoverState,
  viewer: RoomViewer,
  cardLabel: string,
): string | null {
  // 查看阶段本人（或被接管座位）未确认时提示去看词卡（展示契约
  // self-hint 态，本人提示只走底部这一处出口）。选人中的房主指示
  // 归主持任务卡，不在此处。
  if (controls.shouldConfirm) return `请点击下方「${cardLabel}」，查看词语`;
  switch (state.phase) {
    case 'lobby':
      return buildLobbyHostStartMessage({ isLobby: true, viewer });
    case 'preparing':
      return '正在准备词语';
    case 'preparationFailed': {
      const reason = UNDERCOVER_PREPARATION_FAILURE_REASONS[state.failureCode];
      // The host reads the bare reason (their console holds the remedy
      // actions); players additionally get the shared wait object.
      return viewer.isHost
        ? reason
        : buildPreparationFailureMessage({ reason, hostAction: '处理' });
    }
    case 'ongoing':
      // 发言顺序常驻：从本轮起始座位起按座位顺序发言（服务端 round
      // 状态派生，重载一致）。房主选人期间非操作者同样看这一句——
      // 选人窗口不是引擎状态，阶段句即如实表达。
      return `本轮从 ${state.round.speakingStartSeat + 1} 号起按座位顺序发言`;
    case 'viewing':
    case 'ended':
      return null;
  }
}

/**
 * The bottom layout: the word card for participants, and the review
 * （本局复盘） for every reader of a concluded round.
 */
export function createUndercoverPlayerActions(
  controls: Controls,
  state: UndercoverState,
  viewer: RoomViewer,
  review: RoomReviewEntry | null,
): RoomPlayerActionModel {
  const actions: RoomPlayerAction[] = [];
  const cardLabel =
    controls.controlledSeat !== null ? `查看 ${controls.controlledSeat + 1} 号词卡` : '查看我的词';
  // 词卡只属于参赛座位
  // （含被接管座位）。取消选择是房主命令，住主持管理（任务卡的退出动作）。
  const viewCardAction = resolveViewIdentityAction({
    isVisible: controls.canViewCard && !controls.isSelecting,
    label: cardLabel,
    onPress: controls.openCard,
  });
  if (viewCardAction !== null)
    actions.push(
      buildViewIdentityButton(viewCardAction, {
        key: 'card',
        audience: 'participant',
        testID: TESTIDS.roomViewIdentityButton,
        isSubmitting: controls.isSubmitting,
        isPending: controls.shouldConfirm,
      }),
    );
  if (state.phase === 'ended' && review === null) {
    throw new Error('[FAIL-FAST] Undercover ended round has no review entry');
  }
  if (review !== null) actions.push(...buildViewerReviewBottomButtons(review, viewer));
  return {
    message: resolveUndercoverBottomMessage(controls, state, viewer, cardLabel),
    progress: null,
    layout: { primary, secondary, ghost },
  };
}
