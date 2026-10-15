/**
 * promptExecutor.confirmStatus.test.ts - AU-39 Slice 0 golden tests
 *
 * Pins how confirmTriggerExecutor renders the confirm status per viewer
 * (per-role message selection). Since Slice 3 the executor reads the view
 * model's night.confirmStatus, which the engine gates to the viewer of the
 * current confirm step; createContext below projects the raw status the
 * way the view model would surface it for each scenario (a status that is
 * not this viewer's own step status arrives as null).
 * Uses the real SCHEMAS registry: asserted strings are the production texts.
 */

import type { ConfirmStatus } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { WerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus, getSchema, Team } from '@game-judge/game-engine/games/werewolf/public';

import { confirmTriggerExecutor } from '@/games/werewolf/room/executors/promptExecutor';
import type { ExecutorContext } from '@/games/werewolf/room/executors/types';
import type { ActionIntent } from '@/games/werewolf/room/policy/types';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

// =============================================================================
// Fixture helpers
// =============================================================================

const INTENT: ActionIntent = { type: 'confirmTrigger', targetSeat: -1 };

interface PromptCall {
  title: string;
  message: string;
  onDismiss: () => void | Promise<void>;
  buttonLabel?: string;
  alternativeAction?: { label: string; onPress: () => void | Promise<void> };
}

function viewModelWith(confirmStatus: ConfirmStatus | null): WerewolfViewModel {
  return {
    status: GameStatus.Ongoing,
    mySeat: null,
    myRole: null,
    myEffectiveRole: null,
    seats: [],
    wolfPackSeats: null,
    viewedSeats: [],
    night: { stepSchemaKind: 'confirm', confirmStatus, reveals: [], wolfVotesBySeat: null },
    day: { sheriffSeat: null, mvpSeat: null },
  };
}

function createContext(options: {
  schemaId: Parameters<typeof getSchema>[0];
  confirmStatus?: ConfirmStatus;
  effectiveRole: RoleId | null;
  effectiveSeat: number | null;
}): { ctx: ExecutorContext; promptCalls: PromptCall[]; proceedWithAction: jest.Mock } {
  const promptCalls: PromptCall[] = [];
  const proceedWithAction = jest.fn(async () => ({}));
  const gameState = { confirmStatus: options.confirmStatus } as unknown as LocalGameState;
  // The view model surfaces the confirm status only to the viewer whose own
  // confirm step it belongs to; in these scenarios that is exactly the
  // status role matching the viewer's effective role.
  const gatedStatus =
    options.confirmStatus && options.confirmStatus.role === options.effectiveRole
      ? options.confirmStatus
      : null;
  const ctx = {
    gameState,
    viewModel: viewModelWith(gatedStatus),
    effectiveRole: options.effectiveRole,
    effectiveSeat: options.effectiveSeat,
    currentSchema: getSchema(options.schemaId),
    proceedWithAction,
    actionDialogs: {
      showRoleActionPrompt: (
        title: string,
        message: string,
        onDismiss: () => void | Promise<void>,
        buttonLabel?: string,
        alternativeAction?: { label: string; onPress: () => void | Promise<void> },
      ) => {
        promptCalls.push({ title, message, onDismiss, buttonLabel, alternativeAction });
      },
    },
  } as unknown as ExecutorContext;
  return { ctx, promptCalls, proceedWithAction };
}

// =============================================================================
// Shoot confirm (hunter / darkWolfKing)
// =============================================================================

describe('AU-39 golden: confirmTriggerExecutor shoot status', () => {
  it('hunter who can shoot sees the can-shoot text and confirm proceeds', async () => {
    const { ctx, promptCalls, proceedWithAction } = createContext({
      schemaId: 'hunterConfirm',
      confirmStatus: { role: 'hunter', canShoot: true },
      effectiveRole: 'hunter',
      effectiveSeat: 6,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls).toHaveLength(1);
    expect(promptCalls[0]!.title).toBe('技能状态');
    expect(promptCalls[0]!.message).toBe('猎人可以发动技能');
    await promptCalls[0]!.onDismiss();
    expect(proceedWithAction).toHaveBeenCalledWith({ kind: 'confirm' });
  });

  it('hunter who cannot shoot sees the cannot-shoot text', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'hunterConfirm',
      confirmStatus: { role: 'hunter', canShoot: false },
      effectiveRole: 'hunter',
      effectiveSeat: 6,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('猎人不能发动技能');
  });

  it('darkWolfKing who cannot shoot sees the wolf-king cannot-shoot text', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'darkWolfKingConfirm',
      confirmStatus: { role: 'darkWolfKing', canShoot: false },
      effectiveRole: 'darkWolfKing',
      effectiveSeat: 2,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('狼王不能发动技能');
  });

  it('canShoot is read only when the status role matches the viewer effective role', async () => {
    // The status belongs to the hunter, but this viewer is not the hunter:
    // the executor falls back to canShoot=true instead of leaking the status.
    const { ctx, promptCalls } = createContext({
      schemaId: 'hunterConfirm',
      confirmStatus: { role: 'hunter', canShoot: false },
      effectiveRole: 'seer',
      effectiveSeat: 4,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('猎人可以发动技能');
  });

  it('throws fail-fast when there is no effective actor seat', async () => {
    const { ctx } = createContext({
      schemaId: 'hunterConfirm',
      confirmStatus: { role: 'hunter', canShoot: true },
      effectiveRole: 'hunter',
      effectiveSeat: null,
    });

    expect(() => confirmTriggerExecutor(INTENT, ctx)).toThrow(
      '[FAIL-FAST] confirmTrigger requires an effective actor seat',
    );
  });
});

// =============================================================================
// Hidden wolf teammates
// =============================================================================

describe('AU-39 golden: confirmTriggerExecutor hiddenWolf teammates', () => {
  it('hidden wolf sees the teammate seats formatted 1-based', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'hiddenWolfReveal',
      confirmStatus: { role: 'hiddenWolf', wolfTeammates: [1, 3] },
      effectiveRole: 'hiddenWolf',
      effectiveSeat: 0,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls[0]!.title).toBe('狼同伴信息');
    expect(promptCalls[0]!.message).toBe('你的狼同伴为：2号、4号');
  });

  it('a status of another role yields an empty teammate list', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'hiddenWolfReveal',
      confirmStatus: { role: 'hunter', canShoot: true },
      effectiveRole: 'hiddenWolf',
      effectiveSeat: 0,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('你的狼同伴为：无');
  });
});

// =============================================================================
// Avenger faction
// =============================================================================

describe('AU-39 golden: confirmTriggerExecutor avenger faction', () => {
  it.each([
    [Team.Good, '你属于好人阵营'],
    [Team.Wolf, '你属于狼人阵营'],
    [Team.Third, '你与影子绑定，同属第三方阵营'],
  ] as const)('avenger with faction %s sees the matching text', async (faction, expected) => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'avengerConfirm',
      confirmStatus: { role: 'avenger', faction },
      effectiveRole: 'avenger',
      effectiveSeat: 5,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls[0]!.title).toBe('阵营信息');
    expect(promptCalls[0]!.message).toBe(expected);
  });

  it('a status of another role defaults to the good-faction text', async () => {
    const { ctx, promptCalls } = createContext({
      schemaId: 'avengerConfirm',
      confirmStatus: { role: 'hunter', canShoot: false },
      effectiveRole: 'avenger',
      effectiveSeat: 5,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('你属于好人阵营');
  });
});

// =============================================================================
// Seed wolf infection
// =============================================================================

describe('AU-39 golden: confirmTriggerExecutor seedWolf infection', () => {
  it('available infection shows the target and wires confirm / skip', async () => {
    const { ctx, promptCalls, proceedWithAction } = createContext({
      schemaId: 'seedWolfInfect',
      confirmStatus: { role: 'seedWolf', availability: 'available', targetSeat: 2 },
      effectiveRole: 'seedWolf',
      effectiveSeat: 1,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls[0]!.title).toBe('感染目标');
    expect(promptCalls[0]!.message).toBe('狼人选择袭击3号玩家，是否发动感染？');
    expect(promptCalls[0]!.alternativeAction?.label).toBe('不用技能');

    await promptCalls[0]!.onDismiss();
    expect(proceedWithAction).toHaveBeenCalledWith({ kind: 'confirm' });
    await promptCalls[0]!.alternativeAction!.onPress();
    expect(proceedWithAction).toHaveBeenCalledWith({ kind: 'skip' });
  });

  it('unavailable infection shows the unavailable text and never proceeds', async () => {
    const { ctx, promptCalls, proceedWithAction } = createContext({
      schemaId: 'seedWolfInfect',
      confirmStatus: { role: 'seedWolf', availability: 'unavailable', reason: 'noTarget' },
      effectiveRole: 'seedWolf',
      effectiveSeat: 1,
    });

    await confirmTriggerExecutor(INTENT, ctx);

    expect(promptCalls[0]!.message).toBe('本夜没有可感染的狼人袭击目标');
    await promptCalls[0]!.onDismiss();
    expect(proceedWithAction).not.toHaveBeenCalled();
  });

  it('throws fail-fast when the infection step has a non-seedWolf status', async () => {
    const { ctx } = createContext({
      schemaId: 'seedWolfInfect',
      confirmStatus: { role: 'hunter', canShoot: true },
      effectiveRole: 'seedWolf',
      effectiveSeat: 1,
    });

    expect(() => confirmTriggerExecutor(INTENT, ctx)).toThrow(
      '[FAIL-FAST] Seed Wolf confirm step requires infection status',
    );
  });
});
