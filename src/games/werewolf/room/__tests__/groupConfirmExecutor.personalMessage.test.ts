/**
 * groupConfirmExecutor.personalMessage.test.ts - AU-39 Slice 0 golden tests
 *
 * Pins the per-viewer reveal filtering of the four groupConfirm families:
 * each viewer learns only their own subject status (hypnotized / converted /
 * lover partner), never another seat's. Since Slice 3 the executor reads
 * the view model's night.reveals; createContext below projects each raw
 * fixture fact set into the reveal the engine view model produces for that
 * viewer (cross-checked field-for-field by the engine visibility tests).
 * Uses the real SCHEMAS registry: asserted strings are the production texts.
 */

import type {
  WerewolfRevealView,
  WerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus, getSchema } from '@game-judge/game-engine/games/werewolf/public';

import { groupConfirmAckExecutor } from '@/games/werewolf/room/executors/groupConfirmExecutor';
import type { ExecutorContext } from '@/games/werewolf/room/executors/types';
import type { ActionIntent } from '@/games/werewolf/room/policy/types';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

// =============================================================================
// Fixture helpers
// =============================================================================

const INTENT: ActionIntent = { type: 'groupConfirmAck', targetSeat: -1 };

interface PromptCall {
  title: string;
  message: string;
  buttonLabel?: string;
}

/** The reveal the engine view model yields for this viewer and fact set. */
function revealFor(
  schemaId: string,
  gameState: Partial<LocalGameState>,
  actorSeatForUi: number | null,
): WerewolfRevealView {
  const viewer = actorSeatForUi;
  switch (schemaId) {
    case 'piperHypnotizedReveal': {
      const hypnotizedSeats = gameState.hypnotizedSeats ?? [];
      const isSubject = viewer !== null && hypnotizedSeats.includes(viewer);
      return {
        stepId: 'piperHypnotizedReveal',
        isSubject,
        subjectSeats: isSubject ? hypnotizedSeats : null,
        partnerSeat: null,
        hasAcked: false,
        ackedSeats: [],
      };
    }
    case 'awakenedGargoyleConvertReveal':
      return {
        stepId: 'awakenedGargoyleConvertReveal',
        isSubject: viewer !== null && gameState.convertedSeat === viewer,
        subjectSeats: null,
        partnerSeat: null,
        hasAcked: false,
        ackedSeats: [],
      };
    case 'cupidLoversReveal': {
      const loverSeats = gameState.loverSeats;
      const isSubject = viewer !== null && (loverSeats?.includes(viewer) ?? false);
      return {
        stepId: 'cupidLoversReveal',
        isSubject,
        subjectSeats: null,
        partnerSeat:
          isSubject && loverSeats
            ? loverSeats[0] === viewer
              ? (loverSeats[1] ?? null)
              : (loverSeats[0] ?? null)
            : null,
        hasAcked: false,
        ackedSeats: [],
      };
    }
    default: {
      const result = gameState.seedWolfInfectionResult;
      return {
        stepId: 'seedWolfInfectReveal',
        isSubject:
          viewer !== null && result?.outcome === 'converted' && result.targetSeat === viewer,
        subjectSeats: null,
        partnerSeat: null,
        hasAcked: false,
        ackedSeats: [],
      };
    }
  }
}

function viewModelWith(reveal: WerewolfRevealView): WerewolfViewModel {
  return {
    status: GameStatus.Ongoing,
    mySeat: null,
    myRole: null,
    myEffectiveRole: null,
    seats: [],
    wolfPackSeats: null,
    viewedSeats: [],
    night: {
      stepSchemaKind: 'groupConfirm',
      confirmStatus: null,
      reveals: [reveal],
      wolfVotesBySeat: null,
    },
    day: { sheriffSeat: null, mvpSeat: null },
  };
}

function createContext(options: {
  schemaId: Parameters<typeof getSchema>[0];
  gameState: Partial<LocalGameState>;
  actorSeatForUi: number | null;
}): { ctx: ExecutorContext; promptCalls: PromptCall[] } {
  const promptCalls: PromptCall[] = [];
  const ctx = {
    gameState: options.gameState as LocalGameState,
    viewModel: viewModelWith(
      revealFor(options.schemaId, options.gameState, options.actorSeatForUi),
    ),
    currentSchema: getSchema(options.schemaId),
    actorSeatForUi: options.actorSeatForUi,
    groupConfirmAckMutation: { mutate: jest.fn() },
    actionDialogs: {
      showRoleActionPrompt: (
        title: string,
        message: string,
        _onDismiss: unknown,
        buttonLabel?: string,
      ) => {
        promptCalls.push({ title, message, buttonLabel });
      },
    },
  } as unknown as ExecutorContext;
  return { ctx, promptCalls };
}

// =============================================================================
// Piper hypnotized reveal
// =============================================================================

describe('AU-39 golden: groupConfirm piperHypnotizedReveal', () => {
  it('a hypnotized viewer learns the full hypnotized seat list', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'piperHypnotizedReveal',
      gameState: { hypnotizedSeats: [1, 3] },
      actorSeatForUi: 1,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls).toHaveLength(1);
    expect(promptCalls[0]!.title).toBe('催眠信息');
    expect(promptCalls[0]!.message).toBe('你已被吹笛者催眠，当前被催眠的座位：2号、4号');
    expect(promptCalls[0]!.buttonLabel).toBe('知道了');
  });

  it('a non-hypnotized viewer learns only that they are not hypnotized', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'piperHypnotizedReveal',
      gameState: { hypnotizedSeats: [1, 3] },
      actorSeatForUi: 0,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('你未被催眠');
  });

  it('a seatless viewer is treated as not hypnotized', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'piperHypnotizedReveal',
      gameState: { hypnotizedSeats: [1, 3] },
      actorSeatForUi: null,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('你未被催眠');
  });
});

// =============================================================================
// Awakened gargoyle convert reveal
// =============================================================================

describe('AU-39 golden: groupConfirm awakenedGargoyleConvertReveal', () => {
  it('the converted viewer learns they were converted', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'awakenedGargoyleConvertReveal',
      gameState: { convertedSeat: 2 },
      actorSeatForUi: 2,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.title).toBe('转化信息');
    expect(promptCalls[0]!.message).toBe('你已被觉醒石像鬼转化为狼人阵营');
  });

  it('other viewers do not learn who was converted', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'awakenedGargoyleConvertReveal',
      gameState: { convertedSeat: 2 },
      actorSeatForUi: 1,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('你未被转化');
  });
});

// =============================================================================
// Cupid lovers reveal
// =============================================================================

describe('AU-39 golden: groupConfirm cupidLoversReveal', () => {
  it('a lover learns the partner seat', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'cupidLoversReveal',
      gameState: { loverSeats: [1, 4] },
      actorSeatForUi: 1,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.title).toBe('情侣信息');
    expect(promptCalls[0]!.message).toBe('你是情侣之一，你的另一半是：5号');
    expect(promptCalls[0]!.buttonLabel).toBe('我知道了');
  });

  it('the other lover learns the mirrored partner seat', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'cupidLoversReveal',
      gameState: { loverSeats: [1, 4] },
      actorSeatForUi: 4,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('你是情侣之一，你的另一半是：2号');
  });

  it('a non-lover learns only that they are not a lover', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'cupidLoversReveal',
      gameState: { loverSeats: [1, 4] },
      actorSeatForUi: 0,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('你不是情侣');
  });
});

// =============================================================================
// Seed wolf infect reveal
// =============================================================================

describe('AU-39 golden: groupConfirm seedWolfInfectReveal', () => {
  it('the converted viewer learns they were infected', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'seedWolfInfectReveal',
      gameState: { seedWolfInfectionResult: { outcome: 'converted', targetSeat: 2 } },
      actorSeatForUi: 2,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.title).toBe('感染信息');
    expect(promptCalls[0]!.message).toBe('你已被种狼感染并转化为普通狼人');
  });

  it('a failed infection tells the target they were not infected', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'seedWolfInfectReveal',
      gameState: { seedWolfInfectionResult: { outcome: 'failed', targetSeat: 2 } },
      actorSeatForUi: 2,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('你未被感染');
  });

  it('other viewers do not learn the infection target', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'seedWolfInfectReveal',
      gameState: { seedWolfInfectionResult: { outcome: 'converted', targetSeat: 2 } },
      actorSeatForUi: 0,
    });

    await groupConfirmAckExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('你未被感染');
  });
});
