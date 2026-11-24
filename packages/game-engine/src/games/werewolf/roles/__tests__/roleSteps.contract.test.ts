import type { StepRuntime } from '../../../../platform/steps';
import type { StepRecord } from '../../../../platform/steps';
import { buildStepReviewLines, presentStep } from '../../../../platform/steps';
import { createWerewolfRoleContext, WEREWOLF_ROLE_DEFINITIONS } from '..';
import type {
  WerewolfNightFacts,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfRoleStepResult,
} from '../role';

const EMPTY_FACTS: WerewolfNightFacts = {
  selections: [],
  disabledAbilities: [],
  deathEffects: [],
};

const EXPECTED_SINGLE_TARGET_ROLE_IDS = [
  'seer',
  'mirrorSeer',
  'drunkSeer',
  'psychic',
  'gargoyle',
  'pureWhite',
  'wolfWitch',
  'guard',
  'dreamcatcher',
  'silenceElder',
  'votebanElder',
  'crow',
  'wolfQueen',
  'nightmare',
  'eclipseWolfQueen',
  'poisoner',
  'slacker',
  'wildChild',
  'shadow',
] as const;

describe('werewolf single-target role steps', () => {
  it('declares every planned single-target role exactly once', () => {
    expect(WEREWOLF_ROLE_DEFINITIONS.map((role) => role.id)).toEqual(
      EXPECTED_SINGLE_TARGET_ROLE_IDS,
    );
    expect(new Set(WEREWOLF_ROLE_DEFINITIONS.map((role) => role.id)).size).toBe(
      EXPECTED_SINGLE_TARGET_ROLE_IDS.length,
    );
  });

  it.each(WEREWOLF_ROLE_DEFINITIONS)('snapshots generated output for $id', (role) => {
    const state = createState(role.id);
    const initialRuntime = createRuntime(role, state);
    const initial = presentStep(initialRuntime, state, 1);
    const step = role.steps[0];
    if (step === undefined) throw new Error(`[FAIL-FAST] ${role.id} has no step`);
    const result = getCheckResult(role.id);
    const completedRuntime = createRuntime(role, state, {
      bySeat: {
        1: {
          submissions: [{ actionKey: step.id, seats: [2], cardIndex: null }],
          result,
          isResultAcknowledged: false,
        },
      },
    });

    expect({
      initial,
      submitted: presentStep(completedRuntime, state, 1),
      review: buildStepReviewLines(completedRuntime, state),
    }).toMatchSnapshot();
  });

  it('uses the post-swap landing to enforce a repeated-target restriction', () => {
    const guardRole = requireRole('guard');
    const state = createState('guard', {
      previousTargets: [{ roleId: 'guard', actorSeat: 1, targetSeat: 4 }],
    });
    const presentation = presentStep(createRuntime(guardRole, state), state, 1);
    const action = presentation?.actions.find((entry) => entry.kind === 'pickSeats');
    if (action?.kind !== 'pickSeats') throw new Error('[FAIL-FAST] Guard action is missing');

    expect(action.seats.find((option) => option.seat === 2)?.unavailableReason).not.toBeNull();
    expect(action.seats.find((option) => option.seat === 4)?.unavailableReason).toBeNull();
  });

  it('keeps wolf-witch faction restrictions on the selected seat', () => {
    const role = requireRole('wolfWitch');
    const state = createState('wolfWitch');
    const presentation = presentStep(createRuntime(role, state), state, 1);
    const action = presentation?.actions.find((entry) => entry.kind === 'pickSeats');
    if (action?.kind !== 'pickSeats') throw new Error('[FAIL-FAST] Wolf-witch action is missing');

    expect(action.seats.find((option) => option.seat === 3)?.unavailableReason).toBeTruthy();
    expect(action.seats.find((option) => option.seat === 2)?.unavailableReason).toBeNull();
  });

  it('locks a nightmare target and retains the skip action', () => {
    const role = requireRole('seer');
    const state = createState('seer');
    const facts: WerewolfNightFacts = {
      ...EMPTY_FACTS,
      disabledAbilities: [{ roleId: '*', seat: 1 }],
    };
    const presentation = presentStep(createRuntime(role, state, { bySeat: {} }, facts), state, 1);

    expect(presentation?.actions.map((action) => action.key)).toEqual(['seerCheck', '$skip']);
    expect(presentation?.actions[0]?.availability.kind).toBe('unavailable');
  });

  it('resolves death effects at the swapped landing seat', () => {
    const guardResult = resolveRoleTarget('guard', createState('guard'), 2);
    const poisonerResult = resolveRoleTarget('poisoner', createState('poisoner'), 2);

    expect(guardResult.facts?.deathEffects).toEqual([
      {
        kind: 'protect',
        source: 1,
        target: 4,
        against: ['wolfKill'],
        conflictGroup: 'wolfSave',
      },
    ]);
    expect(poisonerResult.facts?.deathEffects).toEqual([
      { kind: 'attack', cause: 'poison', source: 1, target: 4 },
    ]);
  });

  it('applies check-death only when the actual landing seat is a wolf', () => {
    const state = createState('pureWhite');
    const result = resolveRoleTarget('pureWhite', state, 3);

    expect(result.facts?.deathEffects).toEqual([
      { kind: 'attack', cause: 'checkDeath', source: 1, target: 3 },
    ]);
  });

  it('creates role-specific links and wolf-witch check-death at the landing seat', () => {
    const dream = resolveRoleTarget('dreamcatcher', createState('dreamcatcher'), 2);
    const charm = resolveRoleTarget('wolfQueen', createState('wolfQueen'), 2);
    const wolfWitchState = createState('wolfWitch', {
      identities: {
        1: { dealtRole: 'wolfWitch', currentRole: 'wolfWitch', borrowedAbilityRole: null },
        2: { dealtRole: 'pureWhite', currentRole: 'pureWhite', borrowedAbilityRole: null },
        3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        4: { dealtRole: 'dreamcatcher', currentRole: 'dreamcatcher', borrowedAbilityRole: null },
      },
    });
    const wolfWitchResult = resolveRoleTarget('wolfWitch', wolfWitchState, 4);

    expect(dream.facts?.deathEffects?.map((effect) => effect.kind)).toEqual(['link', 'shelter']);
    expect(charm.facts?.deathEffects).toEqual([
      {
        kind: 'link',
        source: 1,
        from: 1,
        to: 4,
        cause: 'wolfQueenLink',
        isMutual: false,
      },
    ]);
    expect(wolfWitchResult.facts?.deathEffects).toEqual([
      { kind: 'attack', cause: 'checkDeath', source: 1, target: 2 },
    ]);
  });

  it('binds the shadow only when the swapped mimic target is the avenger', () => {
    const state = createState('shadow', {
      identities: {
        1: { dealtRole: 'shadow', currentRole: 'shadow', borrowedAbilityRole: null },
        2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
        3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
        4: { dealtRole: 'avenger', currentRole: 'avenger', borrowedAbilityRole: null },
      },
    });

    expect(resolveRoleTarget('shadow', state, 2).facts?.deathEffects).toEqual([
      {
        kind: 'link',
        source: 1,
        from: 1,
        to: 4,
        cause: 'bondedLink',
        isMutual: true,
      },
    ]);
  });

  it('defers eclipse wolf queen skill loss until the downstream effect succeeds', () => {
    const result = resolveRoleTarget('eclipseWolfQueen', createState('eclipseWolfQueen'), 2);

    expect(result.facts?.disabledAbilities).toEqual([]);
    expect(result.facts?.selections).toEqual([
      {
        roleId: 'eclipseWolfQueen',
        actorSeat: 1,
        chosenSeat: 2,
        landingSeat: 4,
      },
    ]);
  });
});

function createState(
  actorRole: string,
  changes: Partial<WerewolfRoleState> = {},
): WerewolfRoleState {
  return {
    identities: {
      1: { dealtRole: actorRole, currentRole: actorRole, borrowedAbilityRole: null },
      2: { dealtRole: 'seer', currentRole: 'seer', borrowedAbilityRole: null },
      3: { dealtRole: 'wolfQueen', currentRole: 'wolfQueen', borrowedAbilityRole: null },
      4: { dealtRole: 'dreamcatcher', currentRole: 'dreamcatcher', borrowedAbilityRole: null },
    },
    location: { swap: { first: 2, second: 4 } },
    sight: { roleOverridesBySeat: {} },
    seatedSeats: [1, 2, 3, 4],
    nightNumber: 2,
    usedAbilities: [],
    disabledAbilities: [],
    previousTargets: [],
    ...changes,
  };
}

function createRuntime(
  role: (typeof WEREWOLF_ROLE_DEFINITIONS)[number],
  state: WerewolfRoleState,
  record: StepRecord<WerewolfRoleStepResult> = { bySeat: {} },
  facts: WerewolfNightFacts = EMPTY_FACTS,
): StepRuntime<
  string,
  WerewolfRoleState,
  WerewolfRoleStepContext,
  WerewolfNightFacts,
  WerewolfRoleStepResult
> {
  const step = role.steps[0];
  if (step === undefined) throw new Error(`[FAIL-FAST] ${role.id} has no step`);
  const roleById = new Map<string, (typeof WEREWOLF_ROLE_DEFINITIONS)[number]>(
    WEREWOLF_ROLE_DEFINITIONS.map((entry) => [entry.id, entry] as const),
  );
  const definitions: Record<string, (typeof role.steps)[number]> = { [step.id]: step };
  return {
    definitions,
    getSlice: () => ({
      order: [step.id],
      current: { stepId: step.id, serial: 1 },
      records: { [step.id]: record },
      deadlineMs: null,
    }),
    getFacts: () => facts,
    createContext: (currentState, currentFacts, seat, currentRecord) => ({
      state: currentState,
      facts: currentFacts,
      seat,
      record: currentRecord,
      role: createWerewolfRoleContext(
        currentState.identities,
        currentState.location,
        currentState.sight,
      ),
      teamOfRole: (roleId) => {
        const found = roleById.get(roleId);
        if (found === undefined) throw new Error(`[FAIL-FAST] Unknown test role: ${roleId}`);
        return found.traits.team;
      },
      roleNameOf: (roleId) => {
        const found = roleById.get(roleId);
        if (found === undefined) throw new Error(`[FAIL-FAST] Unknown test role: ${roleId}`);
        return found.card.name;
      },
      randomBoolean: () => true,
    }),
    isAudioPlaying: () => false,
    seatedSeats: (currentState) => currentState.seatedSeats,
  };
}

function getCheckResult(roleId: string): WerewolfRoleStepResult | null {
  if (['seer', 'mirrorSeer', 'drunkSeer'].includes(roleId)) {
    return { kind: 'factionCheck', chosenSeat: 2, landingSeat: 4, faction: 'good' };
  }
  if (['psychic', 'gargoyle', 'pureWhite', 'wolfWitch'].includes(roleId)) {
    return { kind: 'identityCheck', chosenSeat: 2, landingSeat: 4, roleId: 'dreamcatcher' };
  }
  return null;
}

function requireRole(roleId: string): (typeof WEREWOLF_ROLE_DEFINITIONS)[number] {
  const role = WEREWOLF_ROLE_DEFINITIONS.find((entry) => entry.id === roleId);
  if (role === undefined) throw new Error(`[FAIL-FAST] Missing role ${roleId}`);
  return role;
}

function resolveRoleTarget(
  roleId: string,
  state: WerewolfRoleState,
  chosenSeat: number,
): { readonly facts?: Partial<WerewolfNightFacts>; readonly result?: WerewolfRoleStepResult } {
  const role = requireRole(roleId);
  const step = role.steps[0];
  if (step === undefined) throw new Error(`[FAIL-FAST] ${roleId} has no step`);
  const action = step.actions[0];
  if (action?.kind !== 'pickSeats') {
    throw new Error(`[FAIL-FAST] ${roleId} does not have a seat-selection action`);
  }
  const context = createRuntime(role, state).createContext(state, EMPTY_FACTS, 1, { bySeat: {} });
  return action.resolve(context, [chosenSeat]);
}
