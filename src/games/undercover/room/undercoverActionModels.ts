/** Undercover button availability projected from authoritative phase and explicit local selection. */
import type {
  UndercoverPreparationFailure,
  UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import type {
  RoomBottomActionModel,
  RoomBottomButton,
} from '@/features/room/model/RoomBottomActions';
import {
  buildLobbyHostStartMessage,
  buildPreparationFailureMessage,
  resolveViewIdentityAction,
} from '@/features/room/model/RoomBottomActions';

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
  viewer: { readonly isHost: boolean; readonly mySeat: number | null },
  cardLabel: string,
): string | null {
  // 查看阶段本人（或被接管座位）未确认时提示去看词卡（展示契约
  // self-hint 态，本人提示只走底部这一处出口）。
  if (controls.isSelecting) return '选择本次出局玩家';
  if (controls.shouldConfirm) return `请点击下方「${cardLabel}」，查看词语`;
  switch (state.phase) {
    case 'lobby':
      return buildLobbyHostStartMessage({
        isLobby: true,
        isHost: viewer.isHost,
        mySeat: viewer.mySeat,
      });
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
    case 'aborted':
      return viewer.isHost ? '本局已中止' : '本局已中止，等待房主处理';
    case 'viewing':
    case 'ended':
      return null;
  }
}

export function createUndercoverBottomActions(
  controls: Controls,
  state: UndercoverState,
  viewer: { readonly isHost: boolean; readonly mySeat: number | null },
): RoomBottomActionModel {
  const primary: RoomBottomButton[] = [];
  const ghost: RoomBottomButton[] = [];
  const cardLabel =
    controls.controlledSeat !== null ? `查看 ${controls.controlledSeat + 1} 号词卡` : '查看我的词';
  // The word card is this game's viewing-step main action (the step's
  // server-side confirmation hangs on it), not a persistent review
  // tool: its definition resolves through the shared view-action
  // resolver, but it renders as a stage action in the primary tier —
  // it does not go through buildViewIdentityButton, whose ghost-tier
  // presentation is the platform rule for review tools only.
  const viewCardAction = resolveViewIdentityAction({
    isVisible: controls.canViewCard && !controls.isSelecting,
    label: cardLabel,
    onPress: controls.openCard,
  });
  if (viewCardAction !== null)
    primary.push({
      key: 'card',
      label: viewCardAction.label,
      variant: 'primary',
      size: 'lg',
      testID: 'undercover-view-word',
      isEnabled: true,
      onPress: viewCardAction.onPress,
    });
  if (controls.isSelecting) {
    ghost.push({
      key: 'cancel',
      label: '取消选择',
      variant: 'ghost',
      size: 'md',
      isEnabled: true,
      onPress: controls.cancelSelection,
    });
  }
  return {
    kind: 'stacked',
    message: resolveUndercoverBottomMessage(controls, state, viewer, cardLabel),
    progress: null,
    layout: { primary, secondary: [], ghost },
  };
}
