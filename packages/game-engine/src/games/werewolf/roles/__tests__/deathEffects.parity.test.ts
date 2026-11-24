import {
  calculateDeathsDetailed,
  type NightActions,
  type RoleSeatMap,
} from '../../domain/DeathCalculator';
import { makeWitchPoison, makeWitchSave } from '../../domain/models/actions/WitchAction';
import { type DeathEffect, resolveDeathEffects } from '../deathEffects';

const SEAT_COUNT = 8;
const RANDOM_CASE_COUNT = 4096;

describe('werewolf death effect parity', () => {
  it('matches combined protection conflict and mutual-link settlement', () => {
    expectParity([
      { kind: 'attack', cause: 'wolfKill', source: 0, target: 2 },
      {
        kind: 'protect',
        source: 4,
        target: 2,
        against: ['wolfKill'],
        conflictGroup: 'wolfSave',
      },
      {
        kind: 'protect',
        source: 5,
        target: 2,
        against: ['wolfKill'],
        conflictGroup: 'wolfSave',
      },
      {
        kind: 'link',
        source: 2,
        from: 2,
        to: 3,
        cause: 'bondedLink',
        isMutual: true,
      },
    ]);
  });

  it('keeps dream shelter ahead of other death links and dream-linked deaths', () => {
    expectParity([
      { kind: 'attack', cause: 'wolfKill', source: 0, target: 2 },
      { kind: 'attack', cause: 'poison', source: 1, target: 3 },
      { kind: 'attack', cause: 'checkDeath', source: 1, target: 4 },
      { kind: 'shelter', source: 3, target: 2 },
      {
        kind: 'link',
        source: 3,
        from: 3,
        to: 2,
        cause: 'dreamcatcherLink',
        isMutual: false,
        bypassShelter: true,
      },
      {
        kind: 'link',
        source: 4,
        from: 4,
        to: 2,
        cause: 'wolfQueenLink',
        isMutual: false,
      },
    ]);
  });

  it('matches legacy source blocking for guard and poison effects', () => {
    expectParity([
      { kind: 'attack', cause: 'wolfKill', source: 0, target: 2 },
      {
        kind: 'protect',
        source: 4,
        target: 2,
        against: ['wolfKill'],
        conflictGroup: 'wolfSave',
      },
      { kind: 'void', scope: { source: 4 } },
    ]);
    expectParity([
      { kind: 'attack', cause: 'poison', source: 2, target: 3 },
      { kind: 'void', scope: { source: 2 } },
    ]);
  });

  it('matches the legacy death calculator for supported randomized effects', () => {
    let randomState = 0x6d2b79f5;
    const next = (maximum: number): number => {
      randomState = Math.imul(randomState ^ (randomState >>> 15), randomState | 1);
      randomState ^= randomState + Math.imul(randomState ^ (randomState >>> 7), randomState | 61);
      return ((randomState ^ (randomState >>> 14)) >>> 0) % maximum;
    };

    for (let index = 0; index < RANDOM_CASE_COUNT; index += 1) {
      const effects = createRandomEffects(next);
      const actual = resolveDeathEffects(effects);
      const expected = calculateDeathsDetailed(...toLegacyInputs(effects));

      expect(actual.deaths, `random scenario ${index}: ${JSON.stringify(effects)}`).toEqual(
        expected.deaths,
      );
      expect(
        normalizeCauses(actual.causes),
        `random scenario ${index}: ${JSON.stringify(effects)}`,
      ).toEqual(normalizeCauses(expected.deathSources));
    }
  });
});

function expectParity(effects: readonly DeathEffect[]): void {
  const actual = resolveDeathEffects(effects);
  const expected = calculateDeathsDetailed(...toLegacyInputs(effects));

  expect(actual.deaths).toEqual(expected.deaths);
  expect(normalizeCauses(actual.causes)).toEqual(normalizeCauses(expected.deathSources));
}

function createRandomEffects(next: (maximum: number) => number): DeathEffect[] {
  const effects: DeathEffect[] = [];
  addRandomAttack(effects, next, 'wolfKill', 0);
  addRandomAttack(effects, next, 'checkDeath', 1);
  addRandomAttack(effects, next, 'poison', 2);
  addRandomWolfInfection(effects, next);

  const hasPoisonAttack = effects.some(
    (effect) => effect.kind === 'attack' && effect.cause === 'poison',
  );
  if (next(2) === 1) {
    effects.push({
      kind: 'protect',
      source: 4,
      target: next(SEAT_COUNT),
      against: ['wolfKill'],
      conflictGroup: 'wolfSave',
    });
  }
  if (!hasPoisonAttack && next(2) === 1) {
    effects.push({
      kind: 'protect',
      source: 5,
      target: next(SEAT_COUNT),
      against: ['wolfKill'],
      conflictGroup: 'wolfSave',
    });
  }
  addRandomLinks(effects, next);
  addRandomImmunities(effects, next);
  addRandomReflection(effects, next);
  return effects;
}

function addRandomWolfInfection(effects: DeathEffect[], next: (maximum: number) => number): void {
  const attack = effects.find((effect) => effect.kind === 'attack' && effect.cause === 'wolfKill');
  if (attack?.kind !== 'attack' || next(4) !== 0) return;
  effects.push({ kind: 'void', scope: { cause: 'wolfKill', target: attack.target } });
}

function addRandomAttack(
  effects: DeathEffect[],
  next: (maximum: number) => number,
  cause: 'wolfKill' | 'checkDeath' | 'poison',
  source: number,
): void {
  if (next(3) === 0) return;
  effects.push({ kind: 'attack', cause, source, target: next(SEAT_COUNT) });
}

function addRandomLinks(effects: DeathEffect[], next: (maximum: number) => number): void {
  if (next(2) === 1) {
    effects.push({
      kind: 'link',
      source: 6,
      from: 6,
      to: next(SEAT_COUNT),
      cause: 'wolfQueenLink',
      isMutual: false,
    });
  }
  if (next(2) === 1) {
    const dreamer = next(SEAT_COUNT);
    const dreamTarget = next(SEAT_COUNT);
    effects.push({ kind: 'shelter', source: dreamer, target: dreamTarget });
    effects.push({
      kind: 'link',
      source: dreamer,
      from: dreamer,
      to: dreamTarget,
      cause: 'dreamcatcherLink',
      isMutual: false,
      bypassShelter: true,
    });
  }
  addRandomMutualLink(effects, next, 'bondedLink');
  addRandomMutualLink(effects, next, 'coupleLink');
}

function addRandomMutualLink(
  effects: DeathEffect[],
  next: (maximum: number) => number,
  cause: 'bondedLink' | 'coupleLink',
): void {
  if (next(2) === 0) return;
  const first = next(SEAT_COUNT);
  const second = (first + 1 + next(SEAT_COUNT - 1)) % SEAT_COUNT;
  effects.push({
    kind: 'link',
    source: first,
    from: first,
    to: second,
    cause,
    isMutual: true,
  });
}

function addRandomImmunities(effects: DeathEffect[], next: (maximum: number) => number): void {
  for (let seat = 0; seat < SEAT_COUNT; seat += 1) {
    if (next(5) === 0) effects.push({ kind: 'immune', seat, against: ['poison'] });
    if (next(9) === 0) effects.push({ kind: 'immune', seat, against: ['wolfKill'] });
  }
}

function addRandomReflection(effects: DeathEffect[], next: (maximum: number) => number): void {
  if (next(2) === 0) return;
  effects.push({
    kind: 'reflect',
    seat: next(SEAT_COUNT),
    against: ['checkDeath', 'poison'],
  });
}

function toLegacyInputs(effects: readonly DeathEffect[]): [NightActions, RoleSeatMap] {
  const actions: NightActions = {};
  const roles: RoleSeatMap = {
    wolfQueenLinkSeat: -1,
    dreamcatcherLinkSeat: -1,
    poisonSourceSeat: -1,
    guardProtectorSeat: -1,
    poisonImmuneSeats: [],
    reflectsDamageSeats: [],
    wolfKillSilentImmuneSeats: [],
    checkDeathTargetSeats: [],
    reflectionSources: [],
    bondedLinkSeats: null,
    coupleLinkSeats: null,
  };

  for (const effect of effects) {
    if (effect.kind === 'attack') addLegacyAttack(effect, actions, roles);
    if (effect.kind === 'protect') addLegacyProtection(effect, actions, roles);
    if (effect.kind === 'shelter') actions.dreamcatcherDream = effect.target;
    if (effect.kind === 'link') addLegacyLink(effect, actions, roles);
    if (effect.kind === 'immune') addLegacyImmunity(effect, roles);
    if (effect.kind === 'reflect') roles.reflectsDamageSeats.push(effect.seat);
    if (effect.kind === 'void' && 'cause' in effect.scope && effect.scope.cause === 'wolfKill') {
      actions.seedWolfInfectedSeat = effect.scope.target;
    }
    if (effect.kind === 'void' && 'source' in effect.scope) {
      const blockedSource = effect.scope.source;
      actions.nightmareBlock = blockedSource;
      if (blockedSource === 0) actions.isWolfBlockedByNightmare = true;
      if (
        effects.some(
          (entry) =>
            entry.kind === 'attack' && entry.cause === 'poison' && entry.source === blockedSource,
        )
      ) {
        roles.poisonSourceSeat = blockedSource;
      }
    }
  }
  return [actions, roles];
}

function addLegacyAttack(
  effect: Extract<DeathEffect, { kind: 'attack' }>,
  actions: NightActions,
  roles: RoleSeatMap,
): void {
  if (effect.cause === 'wolfKill') actions.wolfKill = effect.target;
  if (effect.cause === 'poison') actions.witchAction = makeWitchPoison(effect.target);
  if (effect.cause === 'checkDeath') {
    roles.checkDeathTargetSeats.push(effect.target);
    if (effect.source !== null) {
      roles.reflectionSources = [
        ...roles.reflectionSources,
        { sourceSeat: effect.source, targetSeat: effect.target },
      ];
    }
  }
  if (effect.cause === 'poison' && effect.source !== null) {
    roles.reflectionSources = [
      ...roles.reflectionSources,
      { sourceSeat: effect.source, targetSeat: effect.target },
    ];
  }
}

function addLegacyProtection(
  effect: Extract<DeathEffect, { kind: 'protect' }>,
  actions: NightActions,
  roles: RoleSeatMap,
): void {
  if (effect.source === 4) {
    roles.guardProtectorSeat = effect.source;
    actions.guardProtect = effect.target;
  }
  if (effect.source === 5) {
    roles.poisonSourceSeat = effect.source;
    actions.witchAction = makeWitchSave(effect.target);
  }
}

function addLegacyLink(
  effect: Extract<DeathEffect, { kind: 'link' }>,
  actions: NightActions,
  roles: RoleSeatMap,
): void {
  if (effect.cause === 'wolfQueenLink') {
    roles.wolfQueenLinkSeat = effect.from;
    actions.wolfQueenCharm = effect.to;
  }
  if (effect.cause === 'dreamcatcherLink') {
    roles.dreamcatcherLinkSeat = effect.from;
    actions.dreamcatcherDream = effect.to;
  }
  if (effect.cause === 'bondedLink') roles.bondedLinkSeats = [effect.from, effect.to];
  if (effect.cause === 'coupleLink') roles.coupleLinkSeats = [effect.from, effect.to];
}

function addLegacyImmunity(
  effect: Extract<DeathEffect, { kind: 'immune' }>,
  roles: RoleSeatMap,
): void {
  if (effect.against.includes('wolfKill')) roles.wolfKillSilentImmuneSeats.push(effect.seat);
  if (effect.against.includes('poison')) roles.poisonImmuneSeats.push(effect.seat);
}

function normalizeCauses(
  causes: Readonly<Record<number, readonly string[]>>,
): Record<number, readonly string[]> {
  return Object.fromEntries(
    Object.entries(causes).map(([seat, reasons]) => [seat, [...reasons].sort()]),
  );
}
