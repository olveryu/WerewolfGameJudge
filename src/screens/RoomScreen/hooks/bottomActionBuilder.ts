/**
 * bottomActionBuilder — Pure function to compute bottom action button VM.
 *
 * Extracts the getBottomAction logic from useRoomActions into a standalone
 * pure function. Accepts a BottomActionContext and returns a BottomActionVM.
 * No hooks, no side effects.
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema } from '@werewolf/game-engine/models/roles/spec';

import type { ActionIntent } from '@/screens/RoomScreen/policy/types';
import type { LocalGameState } from '@/types/GameStateTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BottomActionVM {
  buttons: BottomButton[];
}

export interface BottomButton {
  /** Stable key (align to schema step keys when possible). */
  key: string; // 'save' | 'skip' | 'wolfEmpty' ...
  label: string;
  intent: ActionIntent;
}

interface BottomActionContext {
  gameState: LocalGameState | null;
  roomStatus: GameStatus;
  isAudioPlaying: boolean;
  currentSchema: ActionSchema | null;
  imActioner: boolean;
  actorSeatNumber: number | null;
  actorRole: RoleId | null;
  multiSelectedSeats: readonly number[];
  hasWolfVoted: (seatNumber: number) => boolean;
  getWitchContext: () => {
    killedSeat: number;
    canSave: boolean;
    canPoison: boolean;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty result constant (avoid creating new objects on every call)
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY: BottomActionVM = { buttons: [] };

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the bottom action buttons for the current game state.
 *
 * Pure function — all dependencies passed via `ctx`. Returns a BottomActionVM
 * containing zero or more buttons for the bottom bar.
 */
export function buildBottomAction(ctx: BottomActionContext): BottomActionVM {
  const {
    gameState,
    roomStatus,
    isAudioPlaying,
    currentSchema,
    imActioner,
    actorSeatNumber,
    actorRole,
    multiSelectedSeats,
    hasWolfVoted,
    getWitchContext,
  } = ctx;

  if (!gameState) return EMPTY;
  if (roomStatus !== GameStatus.Ongoing) return EMPTY;
  if (isAudioPlaying) return EMPTY;
  if (!currentSchema) return EMPTY;

  // All schemas (including groupConfirm): only visible to the actioner.
  // For groupConfirm, determineActionerState already sets imActioner=true for all seated players.
  if (!imActioner) return EMPTY;

  // ─────────────────────────────────────────────────────────────────────────
  // UI Hint（服务端广播驱动，UI 只读展示）
  // ─────────────────────────────────────────────────────────────────────────
  const hint = gameState.ui?.currentActorHint;
  const hintApplies = hint && actorRole && hint.targetRoleIds.includes(actorRole);
  if (hintApplies) {
    if (hint.bottomAction === 'skipOnly') {
      return {
        buttons: [
          {
            key: 'skip',
            label: hint.message,
            intent: { type: 'skip', targetSeat: -1, message: hint.message },
          },
        ],
      };
    }
    if (hint.bottomAction === 'wolfEmptyOnly') {
      return {
        buttons: [
          {
            key: 'wolfEmpty',
            label: hint.message,
            intent: { type: 'wolfVote', targetSeat: -1, wolfSeat: actorSeatNumber ?? undefined },
          },
        ],
      };
    }
    // hint 存在但没有 bottomAction 指示 → 按正常 schema 处理
  }

  // wolfRobot learned hunter gate: must view status before continuing
  if (
    currentSchema.id === 'wolfRobotLearn' &&
    gameState.wolfRobotReveal?.learnedRoleId === 'hunter' &&
    gameState.wolfRobotHunterStatusViewed === false
  ) {
    const gateButtonText = currentSchema.ui?.hunterGateButtonText;
    if (!gateButtonText) {
      throw new Error(
        '[bottomActionBuilder] wolfRobotLearn schema missing ui.hunterGateButtonText - schema-driven UI requires this field',
      );
    }
    return {
      buttons: [
        {
          key: 'viewHunterStatus',
          label: gateButtonText,
          intent: { type: 'wolfRobotViewHunterStatus', targetSeat: -1 },
        },
      ],
    };
  }

  // wolfVote: show empty vote + cancel button when already voted
  if (currentSchema.kind === 'wolfVote') {
    const buttons: BottomButton[] = [];
    const voted = actorSeatNumber !== null && hasWolfVoted(actorSeatNumber);

    // Cancel vote button (withdraw = -2)
    if (voted) {
      buttons.push({
        key: 'wolfCancel',
        label: '取消投票',
        intent: {
          type: 'wolfVote',
          targetSeat: -2,
          wolfSeat: actorSeatNumber ?? undefined,
        },
      });
    }

    // Empty vote button (always available)
    buttons.push({
      key: 'wolfEmpty',
      label: currentSchema.ui!.emptyVoteText!,
      intent: {
        type: 'wolfVote',
        targetSeat: -1,
        wolfSeat: actorSeatNumber ?? undefined,
      },
    });

    return { buttons };
  }

  // chooseSeat/swap: honor canSkip
  // NOTE: witchSave/witchPoison are chooseSeat sub-steps and should allow bottom skip.
  if (currentSchema.kind === 'chooseSeat' || currentSchema.kind === 'swap') {
    if (!currentSchema.canSkip) return EMPTY;
    return {
      buttons: [
        {
          key: 'skip',
          label: currentSchema.ui!.bottomActionText!,
          intent: {
            type: 'skip',
            targetSeat: -1,
            message: currentSchema.ui!.bottomActionText!,
          },
        },
      ],
    };
  }

  // compound (witchAction): return two buttons (save + skip)
  if (
    currentSchema.kind === 'compound' &&
    currentSchema.id === 'witchAction' &&
    currentSchema.steps?.length
  ) {
    const witchCtx = getWitchContext();
    if (!witchCtx) return EMPTY;

    // Schema-driven: save is confirmTarget (target = killedSeat), poison is chooseSeat
    const saveStep = currentSchema.steps.find(
      (s) => s.key === 'save' && s.kind === 'confirmTarget',
    );
    const poisonStep = currentSchema.steps.find(
      (s) => s.key === 'poison' && s.kind === 'chooseSeat',
    );

    const buttons: BottomButton[] = [];

    // 1) Save button (confirmTarget): only show when kill exists and canSave.
    if (saveStep && witchCtx.killedSeat >= 0 && witchCtx.canSave) {
      const label = `对${witchCtx.killedSeat + 1}号用解药`;
      buttons.push({
        key: 'save',
        label,
        intent: {
          type: 'actionConfirm',
          targetSeat: witchCtx.killedSeat,
          message: saveStep.ui?.confirmText,
          stepKey: 'save',
        },
      });
    }

    // 2) Skip button: always available; should mean save=false AND poison=false.
    const skipLabel = poisonStep!.ui!.bottomActionText!;
    buttons.push({
      key: 'skip',
      label: skipLabel,
      intent: { type: 'skip', targetSeat: -1, message: skipLabel, stepKey: 'skipAll' },
    });

    return { buttons };
  }

  // confirm schema (hunterConfirm/darkWolfKingConfirm)
  if (currentSchema.kind === 'confirm') {
    return {
      buttons: [
        {
          key: 'confirm',
          label: currentSchema.ui!.bottomActionText!,
          intent: { type: 'confirmTrigger', targetSeat: -1 },
        },
      ],
    };
  }

  // groupConfirm schema (piperHypnotizedReveal / awakenedGargoyleConvertReveal / cupidLoversReveal)
  if (currentSchema.kind === 'groupConfirm') {
    const acks =
      currentSchema.id === 'awakenedGargoyleConvertReveal'
        ? (gameState.conversionRevealAcks ?? [])
        : currentSchema.id === 'cupidLoversReveal'
          ? (gameState.cupidLoversRevealAcks ?? [])
          : (gameState.piperRevealAcks ?? []);
    if (actorSeatNumber !== null && acks.includes(actorSeatNumber)) {
      return EMPTY;
    }
    return {
      buttons: [
        {
          key: 'groupConfirmAck',
          label: currentSchema.ui!.bottomActionText!,
          intent: { type: 'groupConfirmAck', targetSeat: -1 },
        },
      ],
    };
  }

  // multiChooseSeat (piperHypnotize): confirm + skip buttons
  if (currentSchema.kind === 'multiChooseSeat') {
    const buttons: BottomButton[] = [];
    const count = multiSelectedSeats.length;

    // Confirm button (only when at least 1 target selected)
    if (count > 0) {
      const rawLabel = currentSchema.ui!.confirmButtonText!;
      buttons.push({
        key: 'multiConfirm',
        label: rawLabel.replace('{count}', String(count)),
        intent: {
          type: 'multiSelectConfirm',
          targetSeat: -1,
          targets: multiSelectedSeats,
        },
      });
    }

    // Skip button (if canSkip)
    if (currentSchema.canSkip && currentSchema.ui?.bottomActionText) {
      buttons.push({
        key: 'skip',
        label: currentSchema.ui.bottomActionText,
        intent: { type: 'skip', targetSeat: -1, message: currentSchema.ui.bottomActionText },
      });
    }

    return { buttons };
  }

  // chooseCard schema (treasureMaster): one button to open bottom card selection modal
  if (currentSchema.kind === 'chooseCard') {
    return {
      buttons: [
        {
          key: 'chooseCard',
          label: currentSchema.ui!.bottomActionText!,
          intent: { type: 'chooseCard', targetSeat: -1 },
        },
      ],
    };
  }

  // No generic bottom action
  return EMPTY;
}
