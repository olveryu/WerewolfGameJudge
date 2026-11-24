import {
  type GameState,
  getSchema,
  isBotOccupant,
  PRESET_TEMPLATES,
  type RoleId,
  type SchemaId,
  Team,
  type WerewolfActionInput,
  werewolfEngine,
} from '@game-judge/game-engine/games/werewolf/public';

import { createSeededRng } from '../../../../platform/random';
import { formatSeat } from '../../../../platform/room/formatSeat';
import { cleanupGame, createGame } from '../../__tests__/boards/gameFactory';
import type { NightActions, NightDeal } from '../../__tests__/boards/nightScript';
import { executeFullNight } from '../../__tests__/boards/stepByStepRunner';
import { calculateNightDeaths } from '../../domain/handlers/deathResolution';
import { getWerewolfViewModel, type WerewolfRevealView } from '../../domain/visibility';
import {
  WEREWOLF_ROLE_DEFINITIONS,
  type WerewolfNightFacts,
  type WerewolfRoleDefinition,
  type WerewolfRoleStepResult,
} from '..';
import { LEGACY_NIGHT_SCENARIOS } from './nightLegacyScenarios';
import { NewNightDriver } from './nightParityDriver';

const ROLES = new Map<string, WerewolfRoleDefinition>(
  WEREWOLF_ROLE_DEFINITIONS.map((role) => [role.id, role]),
);
const RANDOM_SEQUENCES = 128;
const RANDOM_ROLES: RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'darkWolfKing',
  'seer',
  'witch',
  'guard',
  'magician',
];

describe('Night-1 old and new engine parity', () => {
  afterEach(() => {
    cleanupGame();
  });

  it.each(PRESET_TEMPLATES)('replays a shared script for the $name preset', (preset) => {
    const context = createGame(preset.name, undefined, { randomSeed: 'bottom-fixture-1' });
    const choices = createPresetChoices(context.getGameState());
    compareNight(context, choices);
  });

  it.each(LEGACY_NIGHT_SCENARIOS)('replays existing $name', (scenario) => {
    const assignment = new Map(scenario.roles.map((roleId, seat) => [seat, roleId]));
    const context = createGame([...scenario.roles], assignment);
    compareNight(context, scenario.choices, scenario.randomSeed);
  });

  it.each(['idiot', 'villager'] as const)(
    'replays the thief and cupid scenario with the %s bottom card',
    (chosenRole) => {
      const context = createGame('盗贼丘比特', undefined, { randomSeed: 'bottom-fixture-1' });
      const state = context.getGameState();
      const seerSeat = findRoleSeat(state, 'seer');
      const thiefSeat = findRoleSeat(state, 'thief');
      const wolfSeat = findRoleSeat(state, 'wolf');
      const villagers = getPlayers(state)
        .filter((player) => player.role === 'villager')
        .map((player) => player.seat);
      const firstVillager = requireSeat(villagers, 0);
      const secondVillager = requireSeat(villagers, 1);
      const choices: NightActions = {
        thief: { cardIndex: requireBottomCard(state, chosenRole) },
        cupid: {
          targets: chosenRole === 'idiot' ? [firstVillager, secondVillager] : [seerSeat, thiefSeat],
        },
        wolf: chosenRole === 'idiot' ? seerSeat : firstVillager,
        witch: chosenRole === 'idiot' ? { save: seerSeat, poison: null } : null,
        seer: chosenRole === 'idiot' ? firstVillager : wolfSeat,
      };
      compareNight(context, choices);
    },
  );

  it.each([
    { seed: 'bottom-fixture-9', card: 'crow', poison: false },
    { seed: 'bottom-fixture-9', card: 'villager', poison: false },
    { seed: 'bottom-fixture-2', card: 'dreamcatcher', poison: false },
    { seed: 'bottom-fixture-2', card: 'villager', poison: true },
  ] as const)(
    'replays the treasure-master scenario with $seed and $card',
    ({ seed, card, poison }) => {
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
      const context = createGame(roles, undefined, { randomSeed: seed });
      const state = context.getGameState();
      const villager = findRoleSeat(state, 'villager');
      const choices: NightActions = {
        treasureMaster: { cardIndex: requireBottomCard(state, card) },
        dreamcatcher: villager,
        crow: villager,
        wolf: null,
        poisoner: poison ? villager : null,
        psychic: findRoleSeat(state, 'wolf'),
      };
      compareNight(context, choices);
    },
  );

  it('reflects a seer check of the spirit knight without killing the knight', () => {
    const context = createGame('恶灵骑士');
    const state = context.getGameState();
    const choices = {
      ...createPresetChoices(state),
      seer: findRoleSeat(state, 'spiritKnight'),
    };
    compareNight(context, choices);
  });

  it('reflects the witch’s poison while the spirit knight remains immune', () => {
    const context = createGame('恶灵骑士');
    const state = context.getGameState();
    const choices = {
      ...createPresetChoices(state),
      witch: { save: null, poison: findRoleSeat(state, 'spiritKnight') },
    };
    compareNight(context, choices);
  });

  it('kills the cursed fox when the seer checks it', () => {
    const context = createGame('咒狐乌鸦');
    const state = context.getGameState();
    const choices = {
      ...createPresetChoices(state),
      seer: findRoleSeat(state, 'cursedFox'),
    };
    compareNight(context, choices);
  });

  it('replays deterministic complete night sequences with swaps, checks, protection and poison', () => {
    const random = createSeededRng('night-parity-sequences');
    const next = (maximum: number): number => Math.floor(random() * maximum);
    const coverage = { swaps: 0, noSwaps: 0, saves: 0, poisons: 0, skips: 0 };

    for (let iteration = 0; iteration < RANDOM_SEQUENCES; iteration += 1) {
      const context = createGame(RANDOM_ROLES, undefined, {
        randomSeed: `night-sequence-${iteration}`,
      });
      const state = context.getGameState();
      const players = getPlayers(state);
      const seats = players.map((player) => player.seat);
      const firstSwap = requireSeat(seats, next(seats.length));
      const secondSwap = requireSeat(
        seats.filter((seat) => seat !== firstSwap),
        next(seats.length - 1),
      );
      const wolfTarget = requireSeat(seats, next(seats.length));
      const witchSeat = findRoleSeat(state, 'witch');
      const seerSeat = findRoleSeat(state, 'seer');
      const seerTargets = seats.filter((seat) => seat !== seerSeat);
      const poisonTarget = requireSeat(seats, next(seats.length));
      const witchMode = next(3);
      const choices: NightActions = {
        magician: next(2) === 0 ? null : { targets: [firstSwap, secondSwap] },
        wolf: wolfTarget,
        witch:
          witchMode === 0 && wolfTarget !== witchSeat
            ? { save: wolfTarget, poison: null }
            : witchMode === 1
              ? { save: null, poison: poisonTarget }
              : null,
        guard: requireSeat(seats, next(seats.length)),
        seer: requireSeat(seerTargets, next(seerTargets.length)),
      };
      if (choices.magician === null) coverage.noSwaps += 1;
      else coverage.swaps += 1;
      if (choices.witch === null) coverage.skips += 1;
      else if (typeof choices.witch === 'object' && 'save' in choices.witch) {
        if (choices.witch.save !== null) coverage.saves += 1;
        if (choices.witch.poison !== null) coverage.poisons += 1;
      }
      compareNight(context, choices);
    }
    for (const [kind, count] of Object.entries(coverage)) {
      expect(count, `random sequences with ${kind}`).toBeGreaterThan(0);
    }
  });
});

function compareNight(
  context: ReturnType<typeof createGame>,
  choices: NightActions,
  randomSeed = 'night-parity-check',
): void {
  const deal = getNightDeal(context.getGameState());
  const driver = new NewNightDriver(deal, choices, randomSeed);
  expect(driver.getStepOrder()).toEqual(context.getNightPlan().steps.map((step) => step.stepId));
  driver.run();
  const legacy = executeFullNight(
    context,
    choices,
    (current, stepId) => {
      const state = current.getGameState();
      compareTargetOptions(state, stepId, driver);
      comparePrivateViews(state, stepId, driver);
    },
    { drunkSeerCheck: { randomSeed } },
  );
  expect(legacy.completed).toBe(true);
  const resolution = driver.resolveDeaths();
  const legacyState = context.getGameState();
  const legacyResolution = calculateNightDeaths(
    legacyState,
    legacyState.resolvedWolfKillTarget ?? null,
  );
  expect(resolution.deaths).toEqual(legacy.deaths);
  expect(legacyResolution.deaths).toEqual(legacy.deaths);
  const swappedSeats = legacyState.currentNightResults?.swappedSeats;
  const bothSwappedSeatsDied =
    swappedSeats !== undefined && swappedSeats.every((seat) => legacy.deaths.includes(seat));
  for (const seat of legacy.deaths) {
    const newCauses = [...(resolution.causes[seat] ?? [])].sort();
    const otherSwappedSeat =
      bothSwappedSeatsDied && swappedSeats !== undefined
        ? swappedSeats.find((swappedSeat) => swappedSeat !== seat)
        : undefined;
    const oldCausesAtSeat = legacyResolution.deathSources[seat] ?? [];
    const oldCausesAtOtherSeat =
      otherSwappedSeat === undefined ? [] : (legacyResolution.deathSources[otherSwappedSeat] ?? []);
    const directAttackCauses = ['wolfKill', 'poison', 'checkDeath'];
    const compareOtherSeat =
      swappedSeats?.includes(seat) === true &&
      otherSwappedSeat !== undefined &&
      [...oldCausesAtSeat, ...oldCausesAtOtherSeat].every((cause) =>
        directAttackCauses.includes(cause),
      );
    const oldCauses = [...(compareOtherSeat ? oldCausesAtOtherSeat : oldCausesAtSeat)]
      .filter((cause) => cause !== 'magicianSwap')
      .sort();
    expect(newCauses, `death causes at seat ${seat}`).toEqual(oldCauses);
  }
  expectPrivateResults(legacyState, driver.getPrivateResults());
  expectPersistentSelections(legacyState, driver.getFacts());
  expectTransientSelections(legacyState, driver.getFacts());
  expect(driver.getInfectionOutcome()).toEqual(legacyState.seedWolfInfectionResult);
  const canShootAsHunter = legacyState.wolfRobotReveal?.canShootAsHunter;
  if (canShootAsHunter !== undefined) {
    expect(driver.getWolfRobotHunterView(findRoleSeat(legacyState, 'wolfRobot'))).toBe(
      canShootAsHunter ? '可以发动技能' : '不能发动技能',
    );
  }
}

function comparePrivateViews(state: GameState, stepId: SchemaId, driver: NewNightDriver): void {
  for (const { seat } of getPlayers(state)) {
    const nightView = getWerewolfViewModel(state, { seat, isHost: seat === 0 }).night;
    const reveal = nightView.reveals[0];
    if (reveal !== undefined) {
      expect(driver.getView(stepId, seat), `${stepId}: view for seat ${seat}`).toBe(
        expectedGroupView(reveal),
      );
    }
    const status = nightView.confirmStatus;
    if (status === null || status.role === 'seedWolf') continue;
    if (status.role === 'hunter' || status.role === 'darkWolfKing') {
      const role = status.role === 'hunter' ? '猎人' : '狼王';
      expect(driver.getView(stepId, seat)).toBe(
        `${role}${status.canShoot ? '可以' : '不能'}发动技能`,
      );
    } else if (status.role === 'avenger') {
      const expected =
        status.faction === Team.Third
          ? '你与影子绑定，同属第三方阵营'
          : status.faction === Team.Wolf
            ? '你属于狼人阵营'
            : '你属于好人阵营';
      expect(driver.getView(stepId, seat)).toBe(expected);
    } else if ('wolfTeammates' in status) {
      const teammates = status.wolfTeammates.map(formatSeat).join('、') || '无';
      expect(driver.getView(stepId, seat)).toBe(`你的狼同伴为：${teammates}`);
    } else {
      throw new Error(`[FAIL-FAST] Unexpected confirmation status for ${status.role}`);
    }
  }
}

function expectedGroupView(view: WerewolfRevealView): string {
  switch (view.stepId) {
    case 'cupidLoversReveal':
      return view.partnerSeat === null
        ? '你不是情侣'
        : `你是情侣之一，你的另一半是：${formatSeat(view.partnerSeat)}`;
    case 'piperHypnotizedReveal':
      return view.subjectSeats === null
        ? '你未被催眠'
        : `你已被吹笛者催眠，当前被催眠的座位：${[...view.subjectSeats]
            .sort((a, b) => a - b)
            .map(formatSeat)
            .join('、')}`;
    case 'awakenedGargoyleConvertReveal':
      return view.isSubject ? '你已被觉醒石像鬼转化为狼人阵营' : '你未被转化';
    case 'seedWolfInfectReveal':
      return view.isSubject ? '你已被种狼感染并转化为普通狼人' : '你未被感染';
    case 'wolfGirlConfessReveal':
      return !view.isConfessed
        ? '你未被表白'
        : view.confessorSeat === null
          ? '你被表白了'
          : `你被表白了，狼女孩是：${formatSeat(view.confessorSeat)}`;
    default:
      throw new Error(`[FAIL-FAST] Unexpected group reveal ${view.stepId}`);
  }
}

function compareTargetOptions(state: GameState, stepId: SchemaId, driver: NewNightDriver): void {
  const schema = getSchema(stepId);
  if (
    schema.kind !== 'chooseSeat' &&
    schema.kind !== 'wolfVote' &&
    schema.kind !== 'compound' &&
    schema.kind !== 'swap' &&
    schema.kind !== 'multiChooseSeat'
  ) {
    return;
  }
  const seats = getPlayers(state).map((player) => player.seat);
  for (const actorSeat of seats) {
    const options = driver.getTargetOptions(stepId, actorSeat);
    for (const targetSeat of seats) {
      expect(
        options.selectableSeats.includes(targetSeat),
        `${stepId}: actor ${actorSeat}, target ${targetSeat}`,
      ).toBe(
        isLegacyTargetSelectable(
          state,
          actorSeat,
          targetSeat,
          schema.kind,
          schema.kind === 'swap' ? 2 : options.minimum,
        ),
      );
    }
    if (stepId === 'awakenedGargoyleConvert' || stepId === 'wolfGirlConfess') {
      expect(options.canSkip, `${stepId}: actor ${actorSeat} skip`).toBe(
        isLegacySubmissionAccepted(state, actorSeat, { kind: 'skip' }),
      );
    }
  }
}

function isLegacyTargetSelectable(
  state: GameState,
  actorSeat: number,
  targetSeat: number,
  kind: ReturnType<typeof getSchema>['kind'],
  minimum: number,
): boolean {
  const possiblePartners =
    minimum > 1
      ? getPlayers(state)
          .filter((player) => player.seat !== targetSeat)
          .map((player) => player.seat)
      : [null];
  return possiblePartners.some((partner) =>
    isLegacySubmissionAccepted(state, actorSeat, legacyInputForTarget(kind, targetSeat, partner)),
  );
}

function isLegacySubmissionAccepted(
  state: GameState,
  actorSeat: number,
  input: WerewolfActionInput,
): boolean {
  const occupant = state.roster[actorSeat];
  const host = state.roster[0];
  if (occupant == null || host == null || isBotOccupant(host)) {
    throw new Error('[FAIL-FAST] Legacy parity fixture has a vacant or bot host seat');
  }
  const actor = isBotOccupant(occupant)
    ? { userId: host.userId, controlledSeat: actorSeat }
    : { userId: occupant.userId, controlledSeat: null };
  const decision = werewolfEngine.decide(
    state,
    { type: 'werewolf.action.submit', input },
    {
      actor: { kind: 'user', userId: actor.userId },
      controlledSeat: actor.controlledSeat,
      commandId: `parity-${actorSeat}`,
      nowMs: 1_000_000,
      randomSeed: 'night-parity-target-probe',
    },
  );
  return decision.kind === 'commit' && decision.outcome.kind !== 'domainRejected';
}

function legacyInputForTarget(
  kind: ReturnType<typeof getSchema>['kind'],
  target: number,
  partner: number | null,
): WerewolfActionInput {
  if (kind === 'compound') return { kind: 'witch', saveTarget: null, poisonTarget: target };
  if (kind === 'swap' || kind === 'multiChooseSeat') {
    return { kind: 'multiTarget', targets: partner === null ? [target] : [target, partner] };
  }
  return { kind: 'target', target };
}

function createPresetChoices(state: GameState): NightActions {
  const players = getPlayers(state);
  const villagerSeats = players
    .filter((player) => player.role === 'villager')
    .map((player) => player.seat);
  const wolfSeats = players
    .filter((player) => getRole(player.role).traits.faction === 'wolf')
    .map((player) => player.seat);
  const wolfTarget = requireSeat(villagerSeats, 0);
  const nonWolfTarget = (roleId: RoleId): number => {
    const actorSeat = findRoleSeat(state, roleId);
    const target = players.find(
      (player) => player.seat !== actorSeat && getRole(player.role).traits.faction !== 'wolf',
    );
    if (target === undefined) throw new Error(`[FAIL-FAST] No target for ${roleId}`);
    return target.seat;
  };
  const checkTarget = (roleId: RoleId): number => {
    const actorSeat = findRoleSeat(state, roleId);
    const target = wolfSeats.find((seat) => seat !== actorSeat);
    if (target === undefined) throw new Error(`[FAIL-FAST] No wolf target for ${roleId}`);
    return target;
  };
  const choices: NightActions = {
    wolf: state.templateRoles.includes('poisoner') ? null : wolfTarget,
    witch: null,
    guard: null,
    seedWolf: { confirmed: false },
  };
  for (const roleId of ['slacker', 'wildChild', 'shadow', 'wolfGirl'] as const) {
    if (hasRole(state, roleId)) choices[roleId] = nonWolfTarget(roleId);
  }
  for (const roleId of ['seer', 'mirrorSeer', 'psychic', 'pureWhite'] as const) {
    if (hasRole(state, roleId)) choices[roleId] = checkTarget(roleId);
  }
  if (hasRole(state, 'gargoyle')) choices.gargoyle = nonWolfTarget('gargoyle');
  if (hasRole(state, 'wolfWitch')) choices.wolfWitch = nonWolfTarget('wolfWitch');
  if (hasRole(state, 'piper')) choices.piper = { targets: [nonWolfTarget('piper')] };
  if (hasRole(state, 'cupid')) {
    choices.cupid = { targets: [requireSeat(villagerSeats, 1), requireSeat(villagerSeats, 2)] };
  }
  if (hasRole(state, 'awakenedGargoyle')) {
    const actorSeat = findRoleSeat(state, 'awakenedGargoyle');
    const target = players.find((player) => {
      if (player.seat === actorSeat || getRole(player.role).traits.faction === 'wolf') return false;
      return wolfSeats.some((wolfSeat) => {
        const distance = Math.abs(player.seat - wolfSeat);
        return distance === 1 || distance === players.length - 1;
      });
    });
    if (target === undefined) throw new Error('[FAIL-FAST] No adjacent conversion target');
    choices.awakenedGargoyle = target.seat;
  }
  if (hasRole(state, 'thief')) choices.thief = { cardIndex: chooseBottomCard(state, true) };
  if (hasRole(state, 'treasureMaster')) {
    choices.treasureMaster = { cardIndex: chooseBottomCard(state, false) };
  }
  return choices;
}

function chooseBottomCard(state: GameState, thief: boolean): number {
  const cards = state.bottomCards;
  if (cards === undefined) throw new Error('[FAIL-FAST] Missing bottom cards');
  const wolfCard = cards.findIndex((roleId) => getRole(roleId).traits.faction === 'wolf');
  const chosen = thief && wolfCard !== -1 ? wolfCard : cards.indexOf('villager');
  if (chosen === -1) throw new Error('[FAIL-FAST] No eligible bottom card');
  return chosen;
}

function expectPrivateResults(
  state: GameState,
  results: Readonly<Record<string, WerewolfRoleStepResult>>,
): void {
  const reveals = [
    { stepId: 'seerCheck', legacy: state.seerReveal },
    { stepId: 'mirrorSeerCheck', legacy: state.mirrorSeerReveal },
    { stepId: 'drunkSeerCheck', legacy: state.drunkSeerReveal },
    { stepId: 'psychicCheck', legacy: state.psychicReveal },
    { stepId: 'gargoyleCheck', legacy: state.gargoyleReveal },
    { stepId: 'pureWhiteCheck', legacy: state.pureWhiteReveal },
    { stepId: 'wolfWitchCheck', legacy: state.wolfWitchReveal },
    { stepId: 'wolfRobotLearn', legacy: state.wolfRobotReveal },
  ];
  for (const { stepId, legacy } of reveals) {
    const actual = results[stepId];
    if (legacy === undefined) {
      expect(actual, stepId).toBeUndefined();
      continue;
    }
    if (actual === undefined || actual.kind === 'cardSelection') {
      throw new Error(`[FAIL-FAST] Missing private result for ${stepId}`);
    }
    expect(actual.chosenSeat, stepId).toBe(legacy.targetSeat);
    const actualResult =
      actual.kind === 'factionCheck'
        ? actual.faction === 'wolf'
          ? '狼人'
          : '好人'
        : actual.roleId;
    expect(actualResult, stepId).toBe(
      stepId === 'wolfRobotLearn' && 'learnedRoleId' in legacy
        ? legacy.learnedRoleId
        : legacy.result,
    );
  }
}

function expectPersistentSelections(state: GameState, facts: WerewolfNightFacts): void {
  const hypnotized = facts.selections
    .filter((selection) => selection.roleId === 'piper')
    .map((selection) => selection.landingSeat)
    .sort((a, b) => a - b);
  expect(hypnotized).toEqual([...state.hypnotizedSeats].sort((a, b) => a - b));
  expect(facts.factionChanges?.find((change) => change.faction === 'wolf')?.seat).toBe(
    state.convertedSeat,
  );
  expect(facts.wolfGirlConfessions?.[0]?.targetSeat).toBe(state.wolfGirlConfessedSeat);
  const lovers = facts.selections
    .filter((selection) => selection.roleId === 'cupid')
    .map((selection) => selection.landingSeat)
    .sort((a, b) => a - b);
  expect(lovers).toEqual(state.loverSeats === undefined ? [] : [...state.loverSeats]);
  for (const roleId of ['thief', 'treasureMaster'] as const) {
    const selection = facts.cardSelections.find((entry) => entry.roleId === roleId);
    const chosenRole =
      selection === undefined ? undefined : state.bottomCards?.[selection.cardIndex];
    expect(chosenRole).toBe(
      roleId === 'thief'
        ? state.currentNightResults?.thiefChosenCard
        : state.currentNightResults?.treasureMasterChosenCard,
    );
  }
}

function expectTransientSelections(state: GameState, facts: WerewolfNightFacts): void {
  const legacy = state.currentNightResults;
  const selections = [
    { roles: ['guard'], target: legacy?.guardedSeat },
    { roles: ['dreamcatcher'], target: legacy?.dreamingSeat },
    { roles: ['nightmare'], target: legacy?.blockedSeat },
    { roles: ['wolfQueen'], target: legacy?.charmedSeat },
    { roles: ['eclipseWolfQueen'], target: legacy?.shelteredSeat },
    { roles: ['silenceElder'], target: legacy?.silencedSeat },
    { roles: ['votebanElder'], target: legacy?.votebannedSeat },
    { roles: ['crow'], target: legacy?.cursedSeat },
    { roles: ['shadow'], target: legacy?.shadowMimicTarget },
    { roles: ['witch', 'poisoner'], target: legacy?.poisonedSeat },
  ];
  for (const { roles, target } of selections) {
    const selection = facts.selections.findLast((entry) => roles.includes(entry.roleId));
    const actual =
      legacy?.swappedSeats === undefined ? selection?.landingSeat : selection?.chosenSeat;
    expect(actual, `legacy ${roles.join('/')} target`).toBe(target);
  }
}

function getPlayers(state: GameState): readonly { readonly seat: number; readonly role: RoleId }[] {
  return Object.values(state.players).flatMap((player) => {
    if (player === null) return [];
    if (player.role === null || player.role === undefined) {
      throw new Error(`[FAIL-FAST] No dealt role at seat ${player.seat}`);
    }
    return [{ seat: player.seat, role: player.role }];
  });
}

function getNightDeal(state: GameState): NightDeal {
  return {
    seats: getPlayers(state),
    templateRoles: state.templateRoles,
    bottomCards: state.bottomCards ?? [],
    seerLabelMap: state.seerLabelMap ?? {},
    witchCanSelfHeal: state.rules?.witchCanSelfHeal === true,
  };
}

function findRoleSeat(state: GameState, roleId: RoleId): number {
  const player = getPlayers(state).find((candidate) => candidate.role === roleId);
  if (player === undefined) throw new Error(`[FAIL-FAST] No seated ${roleId}`);
  return player.seat;
}

function hasRole(state: GameState, roleId: RoleId): boolean {
  return getPlayers(state).some((player) => player.role === roleId);
}

function getRole(roleId: string): WerewolfRoleDefinition {
  const role = ROLES.get(roleId);
  if (role === undefined) throw new Error(`[FAIL-FAST] Missing role ${roleId}`);
  return role;
}

function requireSeat(seats: readonly number[], index: number): number {
  const seat = seats[index];
  if (seat === undefined) throw new Error(`[FAIL-FAST] Missing seat at index ${index}`);
  return seat;
}

function requireBottomCard(state: GameState, roleId: RoleId): number {
  const index = state.bottomCards?.indexOf(roleId) ?? -1;
  if (index < 0) throw new Error(`[FAIL-FAST] Missing bottom card ${roleId}`);
  return index;
}
