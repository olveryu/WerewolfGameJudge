import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { createSeededRng } from '../../../../platform/random';
import { cleanupGame, createGame as createBoardGame } from '../../__tests__/boards/gameFactory';
import { executeFullNight, executeStepsUntil } from '../../__tests__/boards/legacyNightRunner';
import type { NightAction, NightActions, NightDeal } from '../../__tests__/boards/nightScript';
import { getWerewolfViewModel } from '../../domain/visibility';
import {
  createWerewolfRoleContext,
  resolveNightPresenceFacts,
  WEREWOLF_PRESENCE_DECLARATIONS,
  WEREWOLF_ROLE_DEFINITIONS,
  type WerewolfNightFacts,
  type WerewolfRoleDefinition,
  type WerewolfRoleState,
  type WerewolfRoleStepContext,
} from '..';
import { wolfKillStep } from '../wolfKill';
import { NewNightDriver } from './nightParityDriver';

const SELECTED_SEAT = 2;
const LANDING_SEAT = 3;
const ACTOR_SEAT = 1;
const MAGICIAN_SEAT = 0;
const CONVERSION_ACTOR_SEAT = 8;
const CONVERSION_SELECTED_SEAT = 3;
const CONVERSION_LANDING_SEAT = 7;

const SWAPPABLE_SCENARIOS = [
  { roleId: 'nightmare', stepId: 'nightmareBlock', action: SELECTED_SEAT },
  { roleId: 'silenceElder', stepId: 'silenceElderSilence', action: SELECTED_SEAT },
  { roleId: 'votebanElder', stepId: 'votebanElderBan', action: SELECTED_SEAT },
  { roleId: 'crow', stepId: 'crowCurse', action: SELECTED_SEAT },
  { roleId: 'piper', stepId: 'piperHypnotize', action: { targets: [SELECTED_SEAT] } },
  { roleId: 'wolfGirl', stepId: 'wolfGirlConfess', action: SELECTED_SEAT },
  { roleId: 'wildChild', stepId: 'wildChildChooseIdol', action: SELECTED_SEAT },
  { roleId: 'slacker', stepId: 'slackerChooseIdol', action: SELECTED_SEAT },
  { roleId: 'shadow', stepId: 'shadowChooseMimic', action: SELECTED_SEAT },
] as const;

interface SwappableScenario {
  readonly roleId: RoleId;
  readonly stepId: string;
  readonly action: NightAction;
}

const EMPTY_FACTS: WerewolfNightFacts = {
  selections: [],
  identityChanges: [],
  cardSelections: [],
  disabledAbilities: [],
  deathEffects: [],
};

function createGame(...args: Parameters<typeof createBoardGame>) {
  const [template, assignment, options] = args;
  return createBoardGame(template, assignment, { ...options, legacyNight: true });
}

describe('Night-1 target landing parity for magician swaps', () => {
  afterEach(() => {
    cleanupGame();
  });

  it.each(SWAPPABLE_SCENARIOS)(
    '$roleId records the selected seat and resolves its effect at the swapped seat',
    (scenario) => {
      const assignment = createAssignment(scenario.roleId);
      const legacyContext = createGame([...assignment.values()], assignment);
      const choices = createLegacyActions(scenario);
      const driver = runNewNight(legacyContext, assignment, choices);
      const legacy = executeFullNight(legacyContext, choices);
      const legacySelection = getLegacySelectedSeat(legacyContext, scenario);

      expect(legacy.completed).toBe(true);
      expect(legacy.deaths).toEqual([]);
      expect(legacySelection).toBe(SELECTED_SEAT);
      expect(driver.resolveDeaths().deaths).toEqual([]);
      expect(driver.getTargetOptions(scenario.stepId, ACTOR_SEAT).selectableSeats).toContain(
        SELECTED_SEAT,
      );
      expect(
        driver.getFacts().selections.find((entry) => entry.roleId === scenario.roleId),
      ).toEqual({
        roleId: scenario.roleId,
        actorSeat: ACTOR_SEAT,
        chosenSeat: SELECTED_SEAT,
        landingSeat: LANDING_SEAT,
      });
    },
  );

  it('converts the post-swap landing seat while legacy conversion keeps the selected seat', () => {
    const assignment = createAwakenedGargoyleAssignment();
    const legacyContext = createGame([...assignment.values()], assignment);
    const choices: NightActions = {
      magician: { targets: [CONVERSION_SELECTED_SEAT, CONVERSION_LANDING_SEAT] },
      wolf: null,
      awakenedGargoyle: CONVERSION_SELECTED_SEAT,
      witch: { save: null, poison: null },
    };
    const driver = runNewNight(legacyContext, assignment, choices);
    const legacy = executeFullNight(legacyContext, choices);

    expect(legacy.completed).toBe(true);
    expect(legacy.deaths).toEqual([]);
    expect(legacyContext.getGameState().convertedSeat).toBe(CONVERSION_SELECTED_SEAT);

    expect(driver.resolveDeaths().deaths).toEqual([]);
    expect(
      driver.getTargetOptions('awakenedGargoyleConvert', CONVERSION_ACTOR_SEAT).selectableSeats,
    ).toContain(CONVERSION_SELECTED_SEAT);
    expect(
      driver.getFacts().selections.find((entry) => entry.roleId === 'awakenedGargoyle'),
    ).toEqual({
      roleId: 'awakenedGargoyle',
      actorSeat: CONVERSION_ACTOR_SEAT,
      chosenSeat: CONVERSION_SELECTED_SEAT,
      landingSeat: CONVERSION_LANDING_SEAT,
    });
    expect(driver.getFacts().factionChanges).toEqual([
      { seat: CONVERSION_LANDING_SEAT, faction: 'wolf' },
    ]);
  });

  it('silently consumes a wolf-girl confession landing on a wolf', () => {
    const assignment = createAwakenedGargoyleAssignment();
    assignment.set(CONVERSION_ACTOR_SEAT, 'wolfGirl');
    const context = createGame([...assignment.values()], assignment);
    const choices: NightActions = {
      magician: { targets: [3, 4] },
      wolf: null,
      wolfGirl: 3,
    };
    const driver = runNewNight(context, assignment, choices);
    const legacy = executeFullNight(context, choices);

    expect(legacy.completed).toBe(true);
    expect(
      driver.getTargetOptions('wolfGirlConfess', CONVERSION_ACTOR_SEAT).selectableSeats,
    ).toContain(3);
    expect(
      driver.getFacts().selections.find((selection) => selection.roleId === 'wolfGirl'),
    ).toEqual({
      roleId: 'wolfGirl',
      actorSeat: CONVERSION_ACTOR_SEAT,
      chosenSeat: 3,
      landingSeat: 4,
    });
    expect(driver.getFacts().wolfGirlConfessions).toEqual([]);
    for (const seat of assignment.keys()) {
      expect(driver.getView('wolfGirlConfessReveal', seat)).toBe('你未被表白');
    }
  });

  it('silently consumes a conversion landing on a wolf despite legacy adjacency rejection', () => {
    const assignment = createAwakenedGargoyleAssignment();
    const context = createGame([...assignment.values()], assignment);
    const choices: NightActions = {
      magician: { targets: [3, 4] },
      wolf: null,
      awakenedGargoyle: 3,
    };
    const driver = runNewNight(context, assignment, choices);
    expect(executeStepsUntil(context, 'awakenedGargoyleConvert', choices)).toBe(true);
    const legacy = context.dispatchAsSeat(CONVERSION_ACTOR_SEAT, {
      type: 'werewolf.action.submit',
      input: { kind: 'target', target: 3 },
    });

    expect(legacy).toMatchObject({
      kind: 'committed',
      outcome: { kind: 'domainRejected', reason: '只能选择狼人阵营相邻的玩家' },
    });
    expect(
      driver.getTargetOptions('awakenedGargoyleConvert', CONVERSION_ACTOR_SEAT).selectableSeats,
    ).toContain(3);
    expect(
      driver.getFacts().selections.find((selection) => selection.roleId === 'awakenedGargoyle'),
    ).toEqual({
      roleId: 'awakenedGargoyle',
      actorSeat: CONVERSION_ACTOR_SEAT,
      chosenSeat: 3,
      landingSeat: 4,
    });
    expect(driver.getFacts().factionChanges).toEqual([]);
    for (const seat of assignment.keys()) {
      expect(driver.getView('awakenedGargoyleConvertReveal', seat)).toBe('你未被转化');
    }
  });

  it('shows the wolf witch the actual wolf identity under the chosen seat number', () => {
    const assignment = createAwakenedGargoyleAssignment();
    assignment.set(CONVERSION_ACTOR_SEAT, 'wolfWitch');
    const context = createGame([...assignment.values()], assignment);
    const choices: NightActions = {
      magician: { targets: [3, 4] },
      wolf: null,
      wolfWitch: 3,
    };
    const driver = runNewNight(context, assignment, choices);
    const legacy = executeFullNight(context, choices);

    expect(legacy.completed).toBe(true);
    expect(driver.getResultView('wolfWitchCheck', CONVERSION_ACTOR_SEAT)).toEqual({
      title: '查验结果',
      text: '4号是狼人',
    });
  });

  it('shows the seer the actual self-check result under the chosen seat number', () => {
    const assignment = createAssignment('villager');
    assignment.set(2, 'seer');
    assignment.set(3, 'villager');
    const context = createGame([...assignment.values()], assignment);
    const choices: NightActions = {
      magician: { targets: [2, 3] },
      wolf: null,
      seer: 3,
    };
    const driver = runNewNight(context, assignment, choices);
    const legacy = executeFullNight(context, choices);

    expect(legacy.completed).toBe(true);
    expect(driver.getResultView('seerCheck', 2)).toEqual({
      title: '查验结果',
      text: '4号是好人',
    });
  });

  it('exposes the downstream death difference when a nightmare block is swapped', () => {
    const assignment = createAssignment('nightmare');
    assignment.set(SELECTED_SEAT, 'guard');
    assignment.set(LANDING_SEAT, 'villager');
    assignment.set(6, 'villager');
    const context = createGame([...assignment.values()], assignment);
    const choices: NightActions = {
      magician: { targets: [SELECTED_SEAT, LANDING_SEAT] },
      nightmare: SELECTED_SEAT,
      guard: 8,
      wolf: 8,
      witch: null,
    };
    const driver = runNewNight(context, assignment, choices);
    const legacy = executeFullNight(context, choices);

    expect(legacy.deaths).toEqual([8]);
    expect(driver.resolveDeaths().deaths).toEqual([]);
  });

  it('blocks the whole wolf attack and only the targeted wolf personal ability', () => {
    const assignment = createAssignment('nightmare');
    assignment.set(2, 'guard');
    assignment.set(3, 'wolfQueen');
    assignment.set(4, 'wolfWitch');
    assignment.set(6, 'wolf');
    const context = createGame([...assignment.values()], assignment);
    const choices: NightActions = {
      magician: { targets: [2, 3] },
      nightmare: 2,
      wolfQueen: 8,
      wolfWitch: 8,
      guard: 8,
      wolf: 8,
      witch: null,
    };
    const driver = runNewNight(context, assignment, choices);
    const legacy = executeFullNight(context, choices);

    expect(legacy.deaths).toEqual([8]);
    expect(driver.resolveDeaths().deaths).toEqual([]);
    for (const wolfSeat of [1, 3, 4, 6]) {
      expect(driver.getTargetOptions('wolfKill', wolfSeat).unavailableReason).toBe(
        '被噩梦之影恐惧，本夜无法袭击',
      );
    }
    expect(driver.getTargetOptions('wolfQueenCharm', 3).unavailableReason).toBe(
      '被噩梦之影恐惧，本夜无法使用技能',
    );
    expect(driver.getTargetOptions('guardProtect', 2).selectableSeats).toContain(8);
    expect(driver.getResultView('wolfWitchCheck', 4)).toEqual({
      title: '查验结果',
      text: '9号是平民',
    });
  });

  it.each(['wolfQueen', 'spiritKnight'] as const)(
    'keeps the legacy rejection for forbidden wolf target %s (A19)',
    (forbiddenRole) => {
      const assignment = createAssignment('villager');
      assignment.set(LANDING_SEAT, forbiddenRole);
      assignment.set(7, 'wolf');
      assignment.set(8, 'nightmare');
      const legacyContext = createGame([...assignment.values()], assignment);
      const reachedWolfKill = executeStepsUntil(legacyContext, 'wolfKill', {
        wolf: null,
        witch: { save: null, poison: null },
      });
      expect(reachedWolfKill).toBe(true);

      const wolfKillAction = wolfKillStep.actions[0];
      if (wolfKillAction?.kind !== 'pickSeats') {
        throw new Error('[FAIL-FAST] Wolf kill must use a seat-selection action');
      }
      for (const wolfSeat of [LANDING_SEAT, 4, 7, 8]) {
        const legacyView = getWerewolfViewModel(legacyContext.getGameState(), {
          seat: wolfSeat,
          isHost: wolfSeat === 0,
        });
        expect(
          legacyView.seats.find((seat) => seat.seat === LANDING_SEAT)?.disabledReason,
        ).toBeNull();
        const legacyResult = legacyContext.dispatchAsSeat(wolfSeat, {
          type: 'werewolf.action.submit',
          input: { kind: 'target', target: LANDING_SEAT },
        });
        expect(legacyResult.kind).toBe('committed');
        if (legacyResult.kind !== 'committed') {
          throw new Error('[FAIL-FAST] Wolf attack rejection did not commit');
        }
        expect(legacyResult.outcome.kind).toBe('domainRejected');
        const roleContext = createRoleContext(createRoleState(assignment), wolfSeat);
        const blockedTarget = wolfKillAction
          .seats(roleContext)
          .find((target) => target.seat === LANDING_SEAT);
        expect(blockedTarget?.unavailableReason).toBeTruthy();
      }
    },
  );

  it.each([
    { roleId: 'wolfQueen', expectedDeaths: [LANDING_SEAT] },
    { roleId: 'spiritKnight', expectedDeaths: [] },
  ] as const)(
    'settles a swapped wolf attack against $roleId using its actual immunity',
    ({ roleId, expectedDeaths }) => {
      const assignment = createAssignment('villager');
      assignment.set(LANDING_SEAT, roleId);
      assignment.set(11, 'seer');
      const legacyContext = createGame([...assignment.values()], assignment);
      const choices: NightActions = {
        magician: { targets: [SELECTED_SEAT, LANDING_SEAT] },
        wolf: SELECTED_SEAT,
        witch: { save: null, poison: null },
        guard: null,
        seer: 1,
      };
      const driver = runNewNight(legacyContext, assignment, choices);
      const legacy = executeFullNight(legacyContext, choices);

      expect(legacy.completed).toBe(true);
      expect(legacy.deaths).toEqual([LANDING_SEAT]);
      expect(driver.resolveDeaths().deaths).toEqual(expectedDeaths);
    },
  );

  it('lets wolves select the cursed fox but applies its silent wolf-attack immunity', () => {
    const assignment = createAssignment('villager');
    assignment.set(LANDING_SEAT, 'cursedFox');
    assignment.set(11, 'seer');
    const legacyContext = createGame([...assignment.values()], assignment);
    const choices: NightActions = {
      magician: null,
      wolf: LANDING_SEAT,
      witch: { save: null, poison: null },
      guard: null,
      seer: 1,
    };
    const driver = runNewNight(legacyContext, assignment, choices);
    const legacy = executeFullNight(legacyContext, choices);

    expect(legacy.completed).toBe(true);
    expect(legacy.deaths).toEqual([]);
    expect(driver.getTargetOptions('wolfKill', 4).selectableSeats).toContain(LANDING_SEAT);
    expect(driver.resolveDeaths().deaths).toEqual([]);
  });

  it('replays 320 deterministic randomized I5 target selections', () => {
    const random = createSeededRng('i5-target-selections');
    const observedPairs = new Set<string>();
    let firstSelected = 0;
    let secondSelected = 0;
    let comparedScenarios = 0;

    for (const scenario of SWAPPABLE_SCENARIOS) {
      for (let iteration = 0; iteration < 32; iteration += 1) {
        const candidates = [2, 3, 7, 8, 9, 11];
        const firstSeat = chooseRandomSeat(candidates, random);
        const secondSeat = chooseRandomSeat(
          candidates.filter((seat) => seat !== firstSeat),
          random,
        );
        const selectedSeat = random() < 0.5 ? firstSeat : secondSeat;
        const expectedLanding = selectedSeat === firstSeat ? secondSeat : firstSeat;
        observedPairs.add(`${firstSeat}:${secondSeat}`);
        if (selectedSeat === firstSeat) firstSelected += 1;
        else secondSelected += 1;
        const dynamicScenario = {
          ...scenario,
          action: scenario.roleId === 'piper' ? { targets: [selectedSeat] } : selectedSeat,
        };
        const assignment = createAssignment(scenario.roleId);
        cleanupGame();
        const legacyContext = createGame([...assignment.values()], assignment, {
          randomSeed: `i5:${scenario.roleId}:${iteration}`,
        });
        const choices: NightActions = {
          ...createLegacyActions(dynamicScenario),
          magician: { targets: [firstSeat, secondSeat] },
        };
        const driver = runNewNight(legacyContext, assignment, choices);
        const legacy = executeFullNight(legacyContext, choices);
        const legacySelection = getLegacySelectedSeat(legacyContext, scenario);

        expect(legacy.completed).toBe(true);
        expect(legacy.deaths).toEqual([]);
        expect(legacySelection).toBe(selectedSeat);
        expect(driver.resolveDeaths().deaths).toEqual([]);
        expect(driver.getTargetOptions(scenario.stepId, ACTOR_SEAT).selectableSeats).toContain(
          selectedSeat,
        );
        expect(
          driver.getFacts().selections.find((entry) => entry.roleId === scenario.roleId),
        ).toEqual({
          roleId: scenario.roleId,
          actorSeat: ACTOR_SEAT,
          chosenSeat: selectedSeat,
          landingSeat: expectedLanding,
        });
        comparedScenarios += 1;
      }
    }

    for (let iteration = 0; iteration < 32; iteration += 1) {
      const candidates = [3, 7, 9];
      const firstSeat = chooseRandomSeat(candidates, random);
      const secondSeat = chooseRandomSeat(
        candidates.filter((seat) => seat !== firstSeat),
        random,
      );
      const selectedSeat = random() < 0.5 ? firstSeat : secondSeat;
      const expectedLanding = selectedSeat === firstSeat ? secondSeat : firstSeat;
      observedPairs.add(`${firstSeat}:${secondSeat}`);
      if (selectedSeat === firstSeat) firstSelected += 1;
      else secondSelected += 1;
      const assignment = createAwakenedGargoyleAssignment();
      cleanupGame();
      const legacyContext = createGame([...assignment.values()], assignment, {
        randomSeed: `i5:awakenedGargoyle:${iteration}`,
      });
      const choices: NightActions = {
        magician: { targets: [firstSeat, secondSeat] },
        wolf: null,
        awakenedGargoyle: selectedSeat,
        witch: { save: null, poison: null },
      };
      const driver = runNewNight(legacyContext, assignment, choices);
      const legacy = executeFullNight(legacyContext, choices);

      expect(legacy.completed).toBe(true);
      expect(legacy.deaths).toEqual([]);
      expect(legacyContext.getGameState().convertedSeat).toBe(selectedSeat);
      expect(driver.resolveDeaths().deaths).toEqual([]);
      expect(
        driver.getFacts().selections.find((entry) => entry.roleId === 'awakenedGargoyle'),
      ).toEqual({
        roleId: 'awakenedGargoyle',
        actorSeat: CONVERSION_ACTOR_SEAT,
        chosenSeat: selectedSeat,
        landingSeat: expectedLanding,
      });
      expect(driver.getFacts().factionChanges).toEqual([
        { seat: expectedLanding, faction: 'wolf' },
      ]);
      comparedScenarios += 1;
    }

    expect(comparedScenarios).toBe(320);
    expect(observedPairs.size).toBeGreaterThan(20);
    expect(firstSelected).toBeGreaterThan(0);
    expect(secondSelected).toBeGreaterThan(0);
  });
});

function chooseRandomSeat(seats: readonly number[], random: () => number): number {
  const seat = seats[Math.floor(random() * seats.length)];
  if (seat === undefined) throw new Error('[FAIL-FAST] Random fixture has no candidate seat');
  return seat;
}

function createAssignment(actionRole: RoleId): Map<number, RoleId> {
  return new Map<number, RoleId>([
    [MAGICIAN_SEAT, 'magician'],
    [ACTOR_SEAT, actionRole],
    [SELECTED_SEAT, 'villager'],
    [LANDING_SEAT, 'seer'],
    [4, 'wolf'],
    [5, 'witch'],
    [6, 'guard'],
    [7, 'villager'],
    [8, 'villager'],
    [9, 'villager'],
    [10, 'hunter'],
    [11, 'villager'],
  ]);
}

function createLegacyActions(scenario: SwappableScenario): NightActions {
  return {
    magician: { targets: [SELECTED_SEAT, LANDING_SEAT] },
    wolf: null,
    witch: { save: null, poison: null },
    [scenario.roleId]: scenario.action,
  };
}

function runNewNight(
  context: ReturnType<typeof createGame>,
  assignment: ReadonlyMap<number, RoleId>,
  choices: NightActions,
): NewNightDriver {
  const state = context.getGameState();
  const deal: NightDeal = {
    seats: [...assignment].map(([seat, role]) => ({ seat, role })),
    templateRoles: state.templateRoles,
    bottomCards: state.bottomCards ?? [],
    seerLabelMap: state.seerLabelMap ?? {},
    witchCanSelfHeal: state.rules?.witchCanSelfHeal === true,
  };
  const driver = new NewNightDriver(deal, choices, 'i5-parity');
  driver.run();
  return driver;
}

function createRoleState(
  assignment: ReadonlyMap<number, RoleId>,
  swap: { readonly first: number; readonly second: number } = {
    first: SELECTED_SEAT,
    second: LANDING_SEAT,
  },
): WerewolfRoleState {
  const identities = Object.fromEntries(
    [...assignment].map(([seat, roleId]) => [
      seat,
      { dealtRole: roleId, currentRole: roleId, borrowedAbilityRole: null },
    ]),
  );

  return {
    identities,
    location: { swap },
    sight: { roleOverridesBySeat: {} },
    seatedSeats: [...assignment.keys()],
    nightNumber: 1,
    rules: { witchCanSelfHeal: false },
    usedAbilities: [],
    disabledAbilities: [],
    previousTargets: [],
    previousCards: [],
    woundedSeats: [],
    usedResources: [],
  };
}

function createAwakenedGargoyleAssignment(): Map<number, RoleId> {
  return new Map<number, RoleId>([
    [0, 'magician'],
    [1, 'villager'],
    [2, 'villager'],
    [3, 'villager'],
    [4, 'wolf'],
    [5, 'wolf'],
    [6, 'wolf'],
    [7, 'villager'],
    [CONVERSION_ACTOR_SEAT, 'awakenedGargoyle'],
    [9, 'seer'],
    [10, 'witch'],
    [11, 'guard'],
  ]);
}

function getLegacySelectedSeat(
  context: ReturnType<typeof createGame>,
  scenario: SwappableScenario,
): number | undefined {
  const state = context.getGameState();
  if (scenario.roleId === 'piper') {
    return state.hypnotizedSeats[0];
  }
  return state.actions.find((action) => action.schemaId === scenario.stepId)?.targetSeat;
}

function createRoleContext(
  state: WerewolfRoleState,
  seat: number,
  facts: WerewolfNightFacts = EMPTY_FACTS,
): WerewolfRoleStepContext {
  const roleById = new Map<string, WerewolfRoleDefinition>(
    WEREWOLF_ROLE_DEFINITIONS.map((entry) => [entry.id, entry] as const),
  );
  const role = createWerewolfRoleContext(state.identities, state.location, state.sight);
  const getRole = (roleId: string): WerewolfRoleDefinition => {
    const found = roleById.get(roleId);
    if (found === undefined) throw new Error(`[FAIL-FAST] Unknown test role: ${roleId}`);
    return found;
  };

  return {
    state,
    facts,
    seat,
    record: { bySeat: {} },
    role,
    teamOfRole: (roleId) => getRole(roleId).traits.team,
    factionOfRole: (roleId) => getRole(roleId).traits.faction,
    checkReactionOfRole: (roleId) => getRole(roleId).traits.checkReaction,
    doesRoleVoteWithWolves: (roleId) =>
      getRole(roleId).traits.recognition?.participatesInWolfVote === true,
    isWolfKillTargetForbidden: (targetSeat) =>
      getRole(role.roleOf(targetSeat)).traits.wolfKillTargetForbidden === true,
    isAdjacentToWolfFaction: (targetSeat) =>
      state.seatedSeats.some((wolfSeat) => {
        if (getRole(role.roleOf(wolfSeat)).traits.team !== 'wolf') return false;
        const distance = Math.abs(targetSeat - wolfSeat);
        return distance === 1 || distance === state.seatedSeats.length - 1;
      }),
    roleNameOf: (roleId) => getRole(roleId).card.name,
    randomBoolean: () => false,
    nightPresence: resolveNightPresenceFacts(
      Object.values(state.identities).map((identity) => identity.currentRole),
      WEREWOLF_PRESENCE_DECLARATIONS,
    ),
    resolvedWolfKillTarget: null,
    canShootAtNight: () => true,
    avengerFactionOf: () => 'good',
    bottomCardsOf: () => [],
  };
}
