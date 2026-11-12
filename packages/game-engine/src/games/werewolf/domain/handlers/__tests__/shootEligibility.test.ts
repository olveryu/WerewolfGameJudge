import { createGame } from '../../../__tests__/boards/gameFactory';
import { executeFullNight } from '../../../__tests__/boards/stepByStepRunner';
import type { RoleId } from '../../models/roles';
import type { GameState } from '../../protocol/types';
import { buildActionEntries } from '../../review/nightReview';
import { computeCanShootForSeat, maybeCreateConfirmStatusAction } from '../confirmContext';
import { calculateNightDeaths } from '../deathResolution';

function expectEligibility(state: GameState, seat: number, expected: boolean) {
  expect(computeCanShootForSeat(seat, state)).toBe(expected);
  expect(buildActionEntries(state)).toContainEqual(
    expect.objectContaining({ kind: 'shootStatus', actorSeat: seat, canShoot: expected }),
  );
}

describe.each(['hunter', 'darkWolfKing'] as const)('%s shooting eligibility', (role) => {
  it('rejects shooting after a reflected lover dies', () => {
    const base = createGame(['seer', role, 'spiritKnight', 'wolf', 'cupid']).getGameState();
    const state: GameState = {
      ...base,
      loverSeats: [0, 1],
      resolvedWolfKillTarget: null,
      actions: [{ schemaId: 'seerCheck', actorSeat: 0, targetSeat: 2, timestamp: 0 }],
    };
    expect(calculateNightDeaths(state, null).deathReasons).toEqual({
      0: 'reflection',
      1: 'coupleLink',
    });
    expectEligibility(state, 1, false);
  });

  it('preserves eligibility when dream protection prevents the lover death', () => {
    const base = createGame(['seer', role, 'dreamcatcher', 'wolf', 'cupid']).getGameState();
    const state: GameState = {
      ...base,
      loverSeats: [0, 1],
      resolvedWolfKillTarget: 0,
      currentNightResults: { dreamingSeat: 0 },
      actions: [{ schemaId: 'dreamcatcherDream', actorSeat: 2, targetSeat: 0, timestamp: 0 }],
    };
    expect(calculateNightDeaths(state, 0).deaths).toEqual([]);
    expectEligibility(state, 1, true);
  });

  it('rejects shooting after reflection, lover death and queen charm propagate', () => {
    const base = createGame([
      'seer',
      'wolfQueen',
      role,
      'spiritKnight',
      'wolf',
      'cupid',
    ]).getGameState();
    const state: GameState = {
      ...base,
      loverSeats: [0, 1],
      resolvedWolfKillTarget: null,
      currentNightResults: { charmedSeat: 2 },
      actions: [
        { schemaId: 'seerCheck', actorSeat: 0, targetSeat: 3, timestamp: 0 },
        { schemaId: 'wolfQueenCharm', actorSeat: 1, targetSeat: 2, timestamp: 0 },
      ],
    };
    expect(calculateNightDeaths(state, null).deathReasons).toEqual({
      0: 'reflection',
      1: 'coupleLink',
      2: 'wolfQueenLink',
    });
    expectEligibility(state, 2, false);
  });

  it('uses only checks already performed and updates the later review', () => {
    const base = createGame(['seer', role, 'spiritKnight', 'wolf', 'cupid']).getGameState();
    const state: GameState = { ...base, loverSeats: [0, 1], resolvedWolfKillTarget: null };
    const step = role === 'hunter' ? 'hunterConfirm' : 'darkWolfKingConfirm';
    expect(maybeCreateConfirmStatusAction(step, state)).toMatchObject({
      payload: { canShoot: true },
    });
    expectEligibility(
      {
        ...state,
        actions: [{ schemaId: 'seerCheck', actorSeat: 0, targetSeat: 2, timestamp: 0 }],
      },
      1,
      false,
    );
  });
});

describe('shooting eligibility respects protection and transferred damage', () => {
  it.each([
    { guarded: false, saved: false, expected: false },
    { guarded: true, saved: false, expected: true },
    { guarded: false, saved: true, expected: true },
    { guarded: true, saved: true, expected: false },
  ])('guard=$guarded save=$saved: lover eligibility=$expected', ({ guarded, saved, expected }) => {
    const base = createGame([
      'villager',
      'hunter',
      'guard',
      'witch',
      'wolf',
      'cupid',
    ]).getGameState();
    const state: GameState = {
      ...base,
      loverSeats: [0, 1],
      resolvedWolfKillTarget: 0,
      currentNightResults: saved ? { savedSeat: 0 } : {},
      actions: guarded
        ? [{ schemaId: 'guardProtect', actorSeat: 2, targetSeat: 0, timestamp: 0 }]
        : [],
    };
    expectEligibility(state, 1, expected);
  });

  it.each([
    { cause: 'wolfKill', target: 0, swapped: false, deaths: [0], expected: true },
    { cause: 'poison', target: 0, swapped: false, deaths: [0], expected: false },
    { cause: 'wolfKill', target: 1, swapped: true, deaths: [0], expected: true },
    { cause: 'poison', target: 1, swapped: true, deaths: [0], expected: false },
    { cause: 'poison', target: 0, swapped: true, deaths: [1], expected: true },
  ] as const)(
    '$cause at $target, swapped=$swapped: eligibility=$expected',
    ({ cause, target, swapped, deaths, expected }) => {
      const base = createGame(['hunter', 'villager', 'magician', 'witch', 'wolf']).getGameState();
      const state: GameState = {
        ...base,
        resolvedWolfKillTarget: cause === 'wolfKill' ? target : null,
        currentNightResults: {
          ...(cause === 'poison' ? { poisonedSeat: target } : {}),
          ...(swapped ? { swappedSeats: [0, 1] as const } : {}),
        },
      };
      expect(calculateNightDeaths(state, cause === 'wolfKill' ? target : null).deaths).toEqual(
        deaths,
      );
      expectEligibility(state, 0, expected);
    },
  );

  it('keeps a poison contribution when wolf damage also hits the hunter', () => {
    const base = createGame(['hunter', 'witch', 'wolf']).getGameState();
    expectEligibility(
      { ...base, resolvedWolfKillTarget: 0, currentNightResults: { poisonedSeat: 0 } },
      0,
      false,
    );
  });

  it('allows a dreamed hunter to survive poison, but disallows the dream death when the protector dies', () => {
    const base = createGame(['hunter', 'witch', 'dreamcatcher', 'wolf']).getGameState();
    const state: GameState = {
      ...base,
      resolvedWolfKillTarget: null,
      currentNightResults: { dreamingSeat: 0, poisonedSeat: 0 },
      actions: [{ schemaId: 'dreamcatcherDream', actorSeat: 2, targetSeat: 0, timestamp: 0 }],
    };
    expectEligibility(state, 0, true);
    expectEligibility({ ...state, resolvedWolfKillTarget: 2 }, 0, false);
  });

  it('uses resolved dream and charm slots when projecting an authoritative state', () => {
    const base = createGame(['hunter', 'dreamcatcher', 'wolfQueen', 'witch']).getGameState();
    const protectedState: GameState = {
      ...base,
      resolvedWolfKillTarget: null,
      currentNightResults: { dreamingSeat: 0, poisonedSeat: 0 },
    };
    expect(calculateNightDeaths(protectedState, null).deaths).toEqual([]);
    expectEligibility(protectedState, 0, true);
    const charmed: GameState = {
      ...base,
      resolvedWolfKillTarget: null,
      currentNightResults: { charmedSeat: 0, poisonedSeat: 2 },
    };
    expect(calculateNightDeaths(charmed, null).deathReasons[0]).toBe('wolfQueenLink');
    expectEligibility(charmed, 0, false);
  });
});

describe('bottom-card roles use the same death and shooting rules', () => {
  it('settles a thief acting as wolf queen and disallows the charmed hunter', () => {
    const ctx = createGame(
      ['thief', 'wolfQueen', 'hunter', 'witch', 'wolf', 'villager'],
      undefined,
      { randomSeed: 'shoot-thief-3' },
    );
    const initial = ctx.getGameState();
    expect(initial.bottomCards).toEqual(['villager', 'wolfQueen']);
    const thiefSeat = ctx.findSeatByRole('thief');
    const hunterSeat = ctx.findSeatByRole('hunter');
    ctx.dispatchAsSeatOrThrow(
      thiefSeat,
      {
        type: 'werewolf.action.submit',
        input: { kind: 'card', cardIndex: 1 },
      },
      'select the wolf queen card',
    );
    const selected = ctx.getGameState();
    expect(selected.currentNightResults?.thiefChosenCard).toBe('wolfQueen');
    const state: GameState = {
      ...selected,
      resolvedWolfKillTarget: null,
      currentNightResults: {
        ...selected.currentNightResults,
        charmedSeat: hunterSeat,
        poisonedSeat: thiefSeat,
      },
    };
    expect(calculateNightDeaths(state, null).deaths).toEqual(
      [hunterSeat, thiefSeat].sort((a, b) => a - b),
    );
    expectEligibility(state, hunterSeat, false);
  });

  it('settles a treasure master acting as dreamcatcher and disallows the linked hunter', () => {
    const roles: RoleId[] = [
      'psychic',
      'poisoner',
      'hunter',
      'dreamcatcher',
      'crow',
      'darkWolfKing',
      'wolf',
      'wolf',
      'wolf',
      'treasureMaster',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ];
    const ctx = createGame(roles, undefined, { randomSeed: 'bottom-fixture-2' });
    expect(ctx.getGameState().bottomCards).toEqual(['wolf', 'dreamcatcher', 'villager']);
    const masterSeat = ctx.findSeatByRole('treasureMaster');
    const hunterSeat = ctx.findSeatByRole('hunter');
    const result = executeFullNight(ctx, {
      treasureMaster: { cardIndex: 1 },
      dreamcatcher: hunterSeat,
      crow: ctx.findSeatByRole('villager'),
      wolf: null,
      poisoner: masterSeat,
      hunter: { confirmed: true },
      darkWolfKing: { confirmed: true },
      psychic: ctx.findSeatByRole('wolf'),
    });

    expect(result.completed).toBe(true);
    expect(result.deaths).toEqual([masterSeat, hunterSeat].sort((a, b) => a - b));
    expectEligibility(ctx.getGameState(), hunterSeat, false);
  });
});
