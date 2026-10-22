import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import { TESTIDS } from '@/testids';

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
    nightReviewAllowedSeats: [],
    panelFlow: { lastNightInfoConfirmed: false, nightReviewOpened: false },
    ...overrides,
  };
}

const FLOW_INFO_CONFIRMED = { lastNightInfoConfirmed: true, nightReviewOpened: false } as const;
const FLOW_DONE = { lastNightInfoConfirmed: true, nightReviewOpened: true } as const;

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
    it('host → empty player-action layout', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Unseated, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual([]);
    });

    it('host without a seat → empty player-action layout', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Unseated, isHost: true, effectiveSeat: null }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
    });

    it('player → primary: waitForHost (disabled)', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Unseated, isHost: false, effectiveSeat: 1 }),
      );
      expect(keys(layout, 'primary')).toEqual(['waitForHost']);
      expect(layout.primary[0]).toMatchObject({
        isEnabled: false,
      });
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
    it('host → empty player-action layout', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Seated, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual([]);
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
    it('host → ghost: viewRole only (identity is a tool, not a step)', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Assigned, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('player → ghost: viewRole only', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Assigned, isHost: false, effectiveSeat: 1 }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
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
    it('host → ghost: viewRole', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Ready, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('host and player receive the same personal action', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ready,
          isHost: true,
          effectiveSeat: 0,
        }),
      );
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('player → ghost: viewRole', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Ready, isHost: false, effectiveSeat: 1 }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Ongoing — non-actioner
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Ongoing (non-actioner)', () => {
    it('host → ghost: viewRole only', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: true,
          effectiveSeat: 0,
          imActioner: false,
        }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('player → ghost: viewRole', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: false,
          effectiveSeat: 1,
          imActioner: false,
        }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
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

    it('audio playing, non-actioner host → primary: audioWaiting, ghost: empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: true,
          effectiveSeat: 0,
          isAudioPlaying: true,
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['audioWaiting']);
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
      label: '确认催眠（2人）',
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
      it('host actioner → secondary: skip, ghost: viewRole', () => {
        const layout = resolveBottomLayout(actorCtx(true), [skipButton]);
        expect(keys(layout, 'primary')).toEqual([]);
        expect(keys(layout, 'secondary')).toEqual(['skip']);
        expect(keys(layout, 'ghost')).toEqual(['viewRole']);
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
      it('host → ghost only: viewRole', () => {
        const layout = resolveBottomLayout(actorCtx(true), []);
        // No schema buttons → primary/secondary empty, but ghost still shows
        expect(keys(layout, 'primary')).toEqual([]);
        expect(keys(layout, 'secondary')).toEqual([]);
        expect(keys(layout, 'ghost')).toEqual(['viewRole']);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Day
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Day', () => {
    it('host, flow step pending → primary: lastNightInfo, ghost: viewRole + nightReview', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Day, isHost: true, effectiveSeat: 0 }),
      );

      expect(keys(layout, 'primary')).toEqual(['lastNightInfo']);
      expect(layout.primary[0]).toMatchObject({
        label: '昨夜信息',
        testID: TESTIDS.lastNightInfoBottomButton,
        isEnabled: true,
      });
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole', 'nightReview']);
      expect(layout.ghost[1]).toMatchObject({ testID: TESTIDS.nightReviewBottomButton });
    });

    it('host, info confirmed → flow pauses: ghost tools only', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Day,
          isHost: true,
          effectiveSeat: 0,
          panelFlow: FLOW_INFO_CONFIRMED,
        }),
      );

      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole', 'lastNightInfo', 'nightReview']);
    });

    it('player, info confirmed, no review permission → ghost: viewRole + lastNightInfo', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Day,
          isHost: false,
          effectiveSeat: 1,
          panelFlow: FLOW_INFO_CONFIRMED,
        }),
      );

      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole', 'lastNightInfo']);
    });

    // The night-end announcement opens Day with narration still
    // playing: the layout collapses to the audio placeholder exactly
    // as in Ongoing (supersedes the former viewRole-stays pin).
    it('host during audio → primary: audioWaiting, ghost: empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Day,
          isHost: true,
          effectiveSeat: 0,
          isAudioPlaying: true,
        }),
      );

      expect(keys(layout, 'primary')).toEqual(['audioWaiting']);
      expect(layout.primary[0]).toMatchObject({ isEnabled: false });
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual([]);
    });

    it('player during audio → primary: audioWaiting, ghost: empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Day,
          isHost: false,
          effectiveSeat: 1,
          isAudioPlaying: true,
          nightReviewAllowedSeats: [1],
        }),
      );

      expect(keys(layout, 'primary')).toEqual(['audioWaiting']);
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual([]);
    });

    it('spectator during audio → flow surface remains (read-only, no collapse)', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Day,
          isHost: false,
          effectiveSeat: null,
          isAudioPlaying: true,
        }),
      );

      expect(keys(layout, 'primary')).toEqual(['lastNightInfo']);
      expect(layout.primary[0]).toMatchObject({ isEnabled: true });
      expect(keys(layout, 'ghost')).toEqual(['nightReview']);
    });

    it('player with review permission → primary: lastNightInfo, ghost: viewRole + nightReview', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Day,
          isHost: false,
          effectiveSeat: 1,
          nightReviewAllowedSeats: [1],
        }),
      );

      expect(keys(layout, 'primary')).toEqual(['lastNightInfo']);
      expect(keys(layout, 'ghost')).toEqual(['viewRole', 'nightReview']);
    });

    it('player without review permission → primary: lastNightInfo, ghost: viewRole', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Day, isHost: false, effectiveSeat: 1 }),
      );

      expect(keys(layout, 'primary')).toEqual(['lastNightInfo']);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('spectator → primary: lastNightInfo, ghost: nightReview', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Day, isHost: false, effectiveSeat: null }),
      );

      expect(keys(layout, 'primary')).toEqual(['lastNightInfo']);
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['nightReview']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Ended
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Ended', () => {
    it('host, fresh progress → primary: lastNightInfo, ghost: viewRole', () => {
      const layout = resolveBottomLayout(
        makeCtx({ roomStatus: GameStatus.Ended, isHost: true, effectiveSeat: 0 }),
      );
      expect(keys(layout, 'primary')).toEqual(['lastNightInfo']);
      expect(layout.primary[0]).toMatchObject({
        label: '昨夜信息',
        testID: TESTIDS.lastNightInfoBottomButton,
      });
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('host, info confirmed in Day → Ended starts at the review step (progress carries over)', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: true,
          effectiveSeat: 0,
          panelFlow: FLOW_INFO_CONFIRMED,
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['nightReview']);
      expect(layout.primary[0]).toMatchObject({
        label: '本局复盘',
        testID: TESTIDS.nightReviewBottomButton,
      });
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('host, flow done → danger closing row: nextRound + returnToLobby', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: true,
          effectiveSeat: 0,
          panelFlow: FLOW_DONE,
        }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'secondary')).toEqual(['nextRound', 'returnToLobby']);
      expect(layout.secondary.map((button) => button.label)).toEqual(['再来一局', '返回大厅']);
      expect(layout.secondary.map((button) => button.variant)).toEqual(['danger', 'danger']);
      expect(layout.secondary.map((button) => button.testID)).toEqual([
        TESTIDS.nextRoundBottomButton,
        TESTIDS.returnLobbyBottomButton,
      ]);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('host, flow done, audio playing → closing actions held by the audio lock', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: true,
          effectiveSeat: 0,
          panelFlow: FLOW_DONE,
          isAudioPlaying: true,
        }),
      );
      expect(keys(layout, 'secondary')).toEqual(['nextRound', 'returnToLobby']);
      for (const button of layout.secondary) {
        expect(button).toMatchObject({ isEnabled: false, disabledReason: '语音播报中，请稍候' });
      }
      // The read-only ghost tool stays available under the lock.
      expect(layout.ghost[0]).toMatchObject({ key: 'viewRole', isEnabled: true });
    });

    it('player, fresh progress → primary: lastNightInfo regardless of review permission', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: false,
          effectiveSeat: 2,
          nightReviewAllowedSeats: [0, 4],
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['lastNightInfo']);
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('player, flow done → secondary: returnToLobby only', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: false,
          effectiveSeat: 2,
          panelFlow: FLOW_DONE,
        }),
      );
      expect(keys(layout, 'primary')).toEqual([]);
      expect(keys(layout, 'secondary')).toEqual(['returnToLobby']);
      expect(layout.secondary[0]).toMatchObject({ variant: 'danger', isEnabled: true });
      expect(keys(layout, 'ghost')).toEqual(['viewRole']);
    });

    it('spectator, fresh progress → primary: lastNightInfo', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: false,
          effectiveSeat: null,
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['lastNightInfo']);
      expect(keys(layout, 'ghost')).toEqual([]);
    });

    it('spectator, flow done → secondary: returnToLobby only', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ended,
          isHost: false,
          effectiveSeat: null,
          panelFlow: FLOW_DONE,
        }),
      );
      expect(keys(layout, 'secondary')).toEqual(['returnToLobby']);
      expect(keys(layout, 'ghost')).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('audio playing, host actioner → audioWaiting placeholder, ghost empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: true,
          effectiveSeat: 0,
          isAudioPlaying: true,
          imActioner: true,
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['audioWaiting']);
      expect(keys(layout, 'secondary')).toEqual([]);
      expect(keys(layout, 'ghost')).toEqual([]);
      expect(layout.primary[0]).toMatchObject({
        isEnabled: false,
      });
    });

    it('audio playing, player actioner → audioWaiting placeholder, ghost empty', () => {
      const layout = resolveBottomLayout(
        makeCtx({
          roomStatus: GameStatus.Ongoing,
          isHost: false,
          effectiveSeat: 1,
          isAudioPlaying: true,
          imActioner: true,
        }),
      );
      expect(keys(layout, 'primary')).toEqual(['audioWaiting']);
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
        makeCtx({ roomStatus: GameStatus.Day, isHost: true, effectiveSeat: 0 }),
      );
      expect(layout.primary.length).toBeGreaterThan(0);
      for (const btn of layout.primary) {
        expect(btn.variant).toBe('primary');
      }
    });
  });
});
