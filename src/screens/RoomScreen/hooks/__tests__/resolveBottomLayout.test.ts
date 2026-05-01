import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

import type { BottomButton } from '../bottomActionBuilder';
import type { BottomLayout, LayoutContext } from '../bottomLayoutConfig';
import { resolveBottomLayout } from '../resolveBottomLayout';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<LayoutContext> = {}): LayoutContext {
  return {
    roomStatus: GameStatus.Unseated,
    isHost: false,
    effectiveSeat: null,
    imActioner: false,
    isAudioPlaying: false,
    isStartingGame: false,
    isHostActionSubmitting: false,
    nightReviewAllowedSeats: [],
    ...overrides,
  };
}

/** Extract keys from a tier for concise assertions. */
function keys(layout: BottomLayout, tier: 'primary' | 'secondary' | 'ghost'): string[] {
  return layout[tier].map((b) => b.key);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveBottomLayout', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Unseated
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Unseated', () => {
    it('host → primary: settings', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Unseated, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual(['settings']);
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual([]);
      // Settings uses info color
      expect(layout.primary[0]!.buttonColor).toBe(colors.info);
      expect(layout.primary[0]!.testID).toBe(TESTIDS.roomSettingsButton);
    });

    it('host (not seated yet) → primary: settings', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Unseated, isHost: true, effectiveSeat: null }),
      );
      // Host without seat is still 'host' role
      expect(keys(layout, 'primary')).toEqual(['settings']);
    });

    it('player → primary: waitForHost (disabled)', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Unseated, isHost: false, effectiveSeat: 1 }),
      );
      expect(keys(layout, 'primary')).toEqual(['waitForHost']);
      expect(layout.primary[0]!.disabled).toBe(true);
      expect(layout.primary[0]!.fireWhenDisabled).toBe(true);
    });

    it('spectator → empty layout', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Unseated, isHost: false, effectiveSeat: null }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Seated
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Seated', () => {
    it('host → primary: prepareToFlip, ghost: settings', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Seated, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual(['prepareToFlip']);
      expect(keys(layout, 'ghost')).toEqual(['settings']);
      expect(layout.primary[0]!.testID).toBe(TESTIDS.prepareToFlipButton);
    });

    it('player → primary: waitForHost', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Seated, isHost: false, effectiveSeat: 1 }),
      );
      expect(keys(layout, 'primary')).toEqual(['waitForHost']);
      expect(keys(layout, 'ghost')).toEqual([]);
    });

    it('spectator → empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Seated, isHost: false, effectiveSeat: null }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Assigned
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Assigned', () => {
    it('host → primary: viewRole, ghost: restart', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Assigned, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual(['viewRole']);
      expect(keys(layout, 'ghost')).toEqual(['restart']);
      expect(layout.ghost[0]!.textColor).toBe(colors.error);
      expect(layout.ghost[0]!.testID).toBe(TESTIDS.restartButton);
    });

    it('player → primary: viewRole only', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Assigned, isHost: false, effectiveSeat: 1 }),
      );
      expect(keys(layout, 'primary')).toEqual(['viewRole']);
      expect(keys(layout, 'ghost')).toEqual([]);
    });

    it('spectator → empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Assigned, isHost: false, effectiveSeat: null }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Ready
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Ready', () => {
    it('host → primary: startGame, ghost: viewRole + restart', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Ready, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual(['startGame']);
      expect(keys(layout, 'ghost')).toEqual(['viewRole', 'restart']);
      expect(layout.primary[0]!.testID).toBe(TESTIDS.startGameButton);
    });

    it('host submitting → startGame disabled', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ready,
          isHost: true,
          effectiveSeat: 0,
          isHostActionSubmitting: true,
        }),
      );
      expect(layout.primary[0]!.disabled).toBe(true);
    });

    it('player → primary: viewRole', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Ready, isHost: false, effectiveSeat: 1 }),
      );
      expect(keys(layout, 'primary')).toEqual(['viewRole']);
      expect(keys(layout, 'ghost')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Ongoing — non-actioner
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Ongoing (non-actioner)', () => {
    it('host → primary: viewRole, ghost: restart', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: true,
          effectiveSeat: 0,
          imActioner: false,
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['viewRole']);
      expect(keys(layout, 'ghost')).toEqual(['restart']);
    });

    it('player → primary: viewRole', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: false,
          effectiveSeat: 1,
          imActioner: false,
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['viewRole']);
      expect(keys(layout, 'ghost')).toEqual([]);
    });

    it('spectator → empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: false,
          effectiveSeat: null,
          imActioner: false,
        }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
    });

    it('audio playing → empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: true,
          effectiveSeat: 0,
          isAudioPlaying: true,
        }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Ongoing — actioner with schema buttons
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Ongoing (actioner)', () => {
    const skipButton: BottomButton = {
      key: 'skip',
      label: '不用技能',
      intent: { type: 'skip', targetSeat: -1, message: '不用技能' },
    };

    const wolfEmptyButton: BottomButton = {
      key: 'wolfEmpty',
      label: '放弃袭击',
      intent: { type: 'wolfVote', targetSeat: -1 },
    };

    const wolfCancelButton: BottomButton = {
      key: 'wolfCancel',
      label: '取消投票',
      intent: { type: 'wolfVote', targetSeat: -2 },
    };

    const confirmButton: BottomButton = {
      key: 'confirm',
      label: '发动状态',
      intent: { type: 'confirmTrigger', targetSeat: -1 },
    };

    const saveButton: BottomButton = {
      key: 'save',
      label: '对3号用解药',
      intent: { type: 'actionConfirm', targetSeat: 2, stepKey: 'save' },
    };

    const chooseCardButton: BottomButton = {
      key: 'chooseCard',
      label: '选择底牌',
      intent: { type: 'chooseCard', targetSeat: -1 },
    };

    const groupAckButton: BottomButton = {
      key: 'groupConfirmAck',
      label: '催眠状态',
      intent: { type: 'groupConfirmAck', targetSeat: -1 },
    };

    const multiConfirmButton: BottomButton = {
      key: 'multiConfirm',
      label: '确认催眠(2人)',
      intent: { type: 'multiSelectConfirm', targetSeat: -1, targets: [1, 3] },
    };

    const actorCtx = (isHost: boolean): LayoutContext =>
      makeCtx({
        roomStatus: GameStatus.Ongoing,
        isHost,
        effectiveSeat: 0,
        imActioner: true,
      });

    describe('chooseSeat / swap — single skip button', () => {
      it('host actioner → secondary: skip, ghost: viewRole + restart', () => {
        const layout = resolveBottomLayout(actorCtx(true), [skipButton]);
        expect(keys(layout, 'primary')).toEqual([]);
        expect(keys(layout, 'secondary')).toEqual(['skip']);
        expect(keys(layout, 'ghost')).toEqual(['viewRole', 'restart']);
        expect(layout.secondary[0]!.variant).toBe('secondary');
        expect(layout.secondary[0]!.size).toBe('md');
      });

      it('player actioner → secondary: skip, ghost: viewRole', () => {
        const layout = resolveBottomLayout(actorCtx(false), [skipButton]);
        expect(keys(layout, 'secondary')).toEqual(['skip']);
        expect(keys(layout, 'ghost')).toEqual(['viewRole']);
      });
    });

    describe('wolfVote — before voting (single empty)', () => {
      it('secondary: wolfEmpty', () => {
        const layout = resolveBottomLayout(actorCtx(true), [wolfEmptyButton]);
        expect(keys(layout, 'primary')).toEqual([]);
        expect(keys(layout, 'secondary')).toEqual(['wolfEmpty']);
      });
    });

    describe('wolfVote — after voting (cancel + empty)', () => {
      it('primary: wolfCancel, secondary: wolfEmpty', () => {
        const layout = resolveBottomLayout(actorCtx(true), [wolfCancelButton, wolfEmptyButton]);
        expect(keys(layout, 'primary')).toEqual(['wolfCancel']);
        expect(keys(layout, 'secondary')).toEqual(['wolfEmpty']);
        expect(layout.primary[0]!.variant).toBe('primary');
        expect(layout.primary[0]!.size).toBe('lg');
      });
    });

    describe('confirm — single confirm button', () => {
      it('primary: confirm', () => {
        const layout = resolveBottomLayout(actorCtx(true), [confirmButton]);
        expect(keys(layout, 'primary')).toEqual(['confirm']);
        expect(keys(layout, 'secondary')).toEqual([]);
      });
    });

    describe('witch — save + skip', () => {
      it('primary: save, secondary: skip', () => {
        const layout = resolveBottomLayout(actorCtx(false), [saveButton, skipButton]);
        expect(keys(layout, 'primary')).toEqual(['save']);
        expect(keys(layout, 'secondary')).toEqual(['skip']);
      });
    });

    describe('witch — skip only (cannot save)', () => {
      it('secondary: skip', () => {
        const layout = resolveBottomLayout(actorCtx(false), [skipButton]);
        expect(keys(layout, 'primary')).toEqual([]);
        expect(keys(layout, 'secondary')).toEqual(['skip']);
      });
    });

    describe('chooseCard — single confirm-like button', () => {
      it('primary: chooseCard', () => {
        const layout = resolveBottomLayout(actorCtx(false), [chooseCardButton]);
        expect(keys(layout, 'primary')).toEqual(['chooseCard']);
      });
    });

    describe('groupConfirm — single ack button', () => {
      it('primary: groupConfirmAck', () => {
        const layout = resolveBottomLayout(actorCtx(false), [groupAckButton]);
        expect(keys(layout, 'primary')).toEqual(['groupConfirmAck']);
      });
    });

    describe('multiChooseSeat — selected + skip', () => {
      it('primary: multiConfirm, secondary: skip', () => {
        const layout = resolveBottomLayout(actorCtx(true), [multiConfirmButton, skipButton]);
        expect(keys(layout, 'primary')).toEqual(['multiConfirm']);
        expect(keys(layout, 'secondary')).toEqual(['skip']);
      });
    });

    describe('multiChooseSeat — not selected, skip only', () => {
      it('secondary: skip', () => {
        const layout = resolveBottomLayout(actorCtx(true), [skipButton]);
        expect(keys(layout, 'secondary')).toEqual(['skip']);
        expect(keys(layout, 'primary')).toEqual([]);
      });
    });

    describe('hint override — single button', () => {
      const hintSkip: BottomButton = {
        key: 'skip',
        label: '跳过（技能被封锁）',
        intent: { type: 'skip', targetSeat: -1, message: '跳过（技能被封锁）' },
      };

      it('primary: hint skip (overrides secondary classification)', () => {
        // Hint skip has key='skip' but it's the only button from a hint override,
        // so classifySchemaButtons puts it in secondary. This is correct —
        // the user still needs to acknowledge.
        const layout = resolveBottomLayout(actorCtx(false), [hintSkip]);
        expect(keys(layout, 'secondary')).toEqual(['skip']);
      });
    });

    describe('wolfEmpty hint override — single button', () => {
      const hintWolfEmpty: BottomButton = {
        key: 'wolfEmpty',
        label: '放弃袭击（被封锁）',
        intent: { type: 'wolfVote', targetSeat: -1 },
      };

      it('secondary: wolfEmpty', () => {
        const layout = resolveBottomLayout(actorCtx(false), [hintWolfEmpty]);
        expect(keys(layout, 'secondary')).toEqual(['wolfEmpty']);
      });
    });

    describe('wolfRobotLearn hunter gate', () => {
      const gateButton: BottomButton = {
        key: 'viewHunterStatus',
        label: '查看技能状态',
        intent: { type: 'wolfRobotViewHunterStatus', targetSeat: -1 },
      };

      it('primary: viewHunterStatus', () => {
        const layout = resolveBottomLayout(actorCtx(false), [gateButton]);
        expect(keys(layout, 'primary')).toEqual(['viewHunterStatus']);
      });
    });

    describe('no schema buttons (canSkip=false, no selection)', () => {
      it('host → ghost only: viewRole + restart', () => {
        const layout = resolveBottomLayout(actorCtx(true), []);
        // No schema buttons → primary/secondary empty, but ghost still shows
        expect(keys(layout, 'primary')).toEqual([]);
        expect(keys(layout, 'secondary')).toEqual([]);
        expect(keys(layout, 'ghost')).toEqual(['viewRole', 'restart']);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Ended
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Ended', () => {
    it('host → primary: restart (primary variant), ghost: viewRole + nightReview + lastNightInfo', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Ended, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual(['restart']);
      // Ended restart is primary variant, not danger
      expect(layout.primary[0]!.variant).toBe('primary');
      expect(layout.primary[0]!.size).toBe('lg');
      // Ghost buttons
      expect(keys(layout, 'ghost')).toEqual(['viewRole', 'nightReview', 'lastNightInfo']);
    });

    it('player with nightReview permission → primary: viewRole, ghost: nightReview', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: false,
          effectiveSeat: 2,
          nightReviewAllowedSeats: [2, 4],
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['viewRole']);
      expect(keys(layout, 'ghost')).toEqual(['nightReview']);
    });

    it('player without nightReview permission → primary: viewRole only', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: false,
          effectiveSeat: 2,
          nightReviewAllowedSeats: [0, 4],
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['viewRole']);
      expect(keys(layout, 'ghost')).toEqual([]);
    });

    it('spectator → primary: nightReview', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: false,
          effectiveSeat: null,
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['nightReview']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('audio playing during ongoing → empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: true,
          effectiveSeat: 0,
          isAudioPlaying: true,
          imActioner: true,
        }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual([]);
    });

    it('variant correctness: ghost buttons get variant=ghost', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Ready, isHost: true, effectiveSeat: 0 }),
      );
      for (const btn of layout.ghost) {
        expect(btn.variant).toBe('ghost');
      }
    });

    it('variant correctness: primary buttons get variant=primary', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Ready, isHost: true, effectiveSeat: 0 }),
      );
      for (const btn of layout.primary) {
        expect(btn.variant).toBe('primary');
      }
    });
  });
});
