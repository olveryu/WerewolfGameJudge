import {
  getWerewolfNightReview,
  getWerewolfViewModel,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';
import { REASON_SYSTEM_ACTOR_REQUIRED } from '@game-judge/game-engine/platform/protocol/reasons';
import {
  REASON_STEP_STALE,
  STEP_RESULT_ACK_ACTION_KEY,
} from '@game-judge/game-engine/platform/steps';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import {
  dispatchStep,
  executeRemainingSteps,
  executeStepsUntil,
  submitActionOrThrow,
  submitStep,
} from './stepByStepRunner';

const CUSTOM_ROLES: RoleId[] = [
  'villager',
  'villager',
  'villager',
  'hunter',
  'wolf',
  'wolf',
  'wolf',
  'wolfRobot',
  'seer',
  'witch',
  'guard',
  'psychic',
];

const WOLF_ROBOT_SEAT = 7;
const HUNTER_SEAT = 3;

function createRoleAssignment(): Map<number, RoleId> {
  return new Map(CUSTOM_ROLES.map((role, seat) => [seat, role]));
}

function reachWolfRobot(context: GameContext, poison: number | null): void {
  expect(
    executeStepsUntil(context, 'wolfRobotLearn', {
      wolf: 0,
      witch: { save: null, poison },
      hunter: { confirmed: true },
    }),
  ).toBe(true);
}

function learnHunter(context: GameContext): void {
  submitActionOrThrow(
    context,
    WOLF_ROBOT_SEAT,
    { kind: 'target', target: HUNTER_SEAT },
    'wolf robot learns hunter',
  );
}

function acknowledgeHunterStatus(context: GameContext, expectedText: string): void {
  submitStep(
    context,
    WOLF_ROBOT_SEAT,
    { actionKey: STEP_RESULT_ACK_ACTION_KEY },
    'acknowledge learned role',
  );
  const action = getWerewolfViewModel(context.getGameState(), {
    seat: WOLF_ROBOT_SEAT,
    isHost: false,
  }).step?.actions.find((entry) => entry.key === 'wolfRobotHunterStatus');
  expect(action).toMatchObject({ kind: 'view', content: { text: expectedText } });
  submitStep(
    context,
    WOLF_ROBOT_SEAT,
    { actionKey: 'wolfRobotHunterStatus' },
    'view hunter status',
  );
}

describe('Night-1: WolfRobot learns Hunter + Witch poison scenarios (12p)', () => {
  afterEach(() => {
    cleanupGame();
  });

  it('requires the robot to acknowledge both the learned role and hunter status', () => {
    const context = createGame(CUSTOM_ROLES, createRoleAssignment());
    reachWolfRobot(context, null);
    learnHunter(context);

    const learnedState = context.getGameState();
    expect(
      learnedState.nightState?.slice.records.wolfRobotLearn?.bySeat[WOLF_ROBOT_SEAT],
    ).toMatchObject({
      result: {
        kind: 'identityCheck',
        chosenSeat: HUNTER_SEAT,
        landingSeat: HUNTER_SEAT,
        roleId: 'hunter',
      },
      isResultAcknowledged: false,
    });
    expect(learnedState.nightState?.roles.sight.roleOverridesBySeat[WOLF_ROBOT_SEAT]).toBe(
      'hunter',
    );
    expect(context.dispatchInternalAsUser({ type: 'werewolf.phase.settleExpired' })).toMatchObject({
      kind: 'rejected',
      reason: REASON_SYSTEM_ACTOR_REQUIRED,
    });
    expect(
      dispatchStep(context, HUNTER_SEAT, { actionKey: 'wolfRobotHunterStatus' }),
    ).toMatchObject({
      kind: 'rejected',
      reason: REASON_STEP_STALE,
    });

    submitStep(
      context,
      WOLF_ROBOT_SEAT,
      { actionKey: STEP_RESULT_ACK_ACTION_KEY },
      'acknowledge learned role',
    );
    expect(context.getGameState().nightState?.slice.current?.stepId).toBe('wolfRobotLearn');
    const status = getWerewolfViewModel(context.getGameState(), {
      seat: WOLF_ROBOT_SEAT,
      isHost: false,
    }).step?.actions.find((action) => action.key === 'wolfRobotHunterStatus');
    expect(status).toMatchObject({ kind: 'view', content: { text: '可以发动技能' } });

    submitStep(
      context,
      WOLF_ROBOT_SEAT,
      { actionKey: 'wolfRobotHunterStatus' },
      'view hunter status',
    );
    const afterGate = context.getGameState();
    expect(
      afterGate.nightState?.slice.records.wolfRobotLearn?.bySeat[WOLF_ROBOT_SEAT]?.submissions,
    ).toContainEqual({ actionKey: 'wolfRobotHunterStatus', seats: [], cardIndex: null });
    expect(afterGate.nightState?.slice.current?.stepId).not.toBe('wolfRobotLearn');
  });

  it.each([
    { poison: WOLF_ROBOT_SEAT, expectedText: '不能发动技能', dies: true },
    { poison: null, expectedText: '可以发动技能', dies: false },
  ])('retains the learned identity when poison is $poison', ({ poison, expectedText, dies }) => {
    const context = createGame(CUSTOM_ROLES, createRoleAssignment());
    reachWolfRobot(context, poison);
    learnHunter(context);
    acknowledgeHunterStatus(context, expectedText);

    const { deaths, completed } = executeRemainingSteps(context, { seer: 4, psychic: 5 });
    expect(completed).toBe(true);
    expect(deaths.includes(WOLF_ROBOT_SEAT)).toBe(dies);
    expect(deaths).toContain(0);
    const finalState = context.getGameState();
    expect(
      finalState.nightState?.slice.records.wolfRobotLearn?.bySeat[WOLF_ROBOT_SEAT]?.result,
    ).toMatchObject({ kind: 'identityCheck', roleId: 'hunter' });
    expect(finalState.nightState?.roles.identities[WOLF_ROBOT_SEAT]?.borrowedAbilityRole).toBe(
      'hunter',
    );
    expect(finalState.nightState?.roles.sight.roleOverridesBySeat[WOLF_ROBOT_SEAT]).toBe('hunter');
    const robotReview = getWerewolfNightReview(finalState).stepLines?.filter(
      (line) => line.kind === 'action' && line.roleId === 'wolfRobot',
    );
    expect(robotReview).toHaveLength(1);
    expect(robotReview?.[0]).toMatchObject({
      phrase: '学习4号',
      result: '（学习结果：4号是猎人）',
    });
  });

  it('learning a non-hunter advances after the role result without a hunter-status view', () => {
    const context = createGame(CUSTOM_ROLES, createRoleAssignment());
    reachWolfRobot(context, null);
    submitActionOrThrow(context, WOLF_ROBOT_SEAT, { kind: 'target', target: 0 }, 'learn villager');
    expect(
      context.getGameState().nightState?.slice.records.wolfRobotLearn?.bySeat[WOLF_ROBOT_SEAT]
        ?.result,
    ).toMatchObject({ kind: 'identityCheck', roleId: 'villager' });
    submitStep(
      context,
      WOLF_ROBOT_SEAT,
      { actionKey: STEP_RESULT_ACK_ACTION_KEY },
      'acknowledge learned role',
    );
    expect(context.getGameState().nightState?.slice.current?.stepId).not.toBe('wolfRobotLearn');
  });

  it('skipping the learn step advances without a result or hunter-status view', () => {
    const context = createGame(CUSTOM_ROLES, createRoleAssignment());
    reachWolfRobot(context, null);
    submitActionOrThrow(context, WOLF_ROBOT_SEAT, { kind: 'skip' }, 'skip learning');
    expect(
      context.getGameState().nightState?.slice.records.wolfRobotLearn?.bySeat[WOLF_ROBOT_SEAT]
        ?.result,
    ).toBeNull();
    expect(context.getGameState().nightState?.slice.current?.stepId).not.toBe('wolfRobotLearn');
  });
});
