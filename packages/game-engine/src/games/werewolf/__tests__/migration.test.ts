/** v5 -> v6 player-record split migration: identity moves to the roster. */

import { GameStatus } from '../domain/models/GameStatus';
import { createTemplateFromRoles } from '../domain/models/Template';
import type { GameState } from '../domain/protocol/types';
import { gameReducer } from '../domain/reducer/gameReducer';
import { buildInitialGameState } from '../domain/state/buildInitialState';
import { migratePersistedWerewolfState, parseWerewolfState } from '../state/parseState';

function buildV6State(): GameState {
  let state = buildInitialGameState(
    'ROOM',
    'host',
    createTemplateFromRoles(['wolf', 'seer', 'villager']),
  );
  state = gameReducer(state, {
    type: 'PLAYER_JOIN',
    payload: {
      seat: 0,
      occupant: { seat: 0, userId: 'host' },
      player: { seat: 0, role: null, hasViewedRole: false },
      rosterEntry: { displayName: '房主' },
    },
  });
  state = gameReducer(state, {
    type: 'PLAYER_JOIN',
    payload: {
      seat: 1,
      occupant: { seat: 1, userId: 'alice' },
      player: { seat: 1, role: null, hasViewedRole: false },
      rosterEntry: { displayName: 'Alice' },
    },
  });
  state = gameReducer(state, {
    type: 'FILL_WITH_BOTS',
    payload: {
      bots: { 2: { seat: 2, hasViewedRole: false } },
      botRoster: { 'bot-2': { displayName: '机器人3号' } },
    },
  });
  // Assign roles and mark everyone as having viewed, as a started game would.
  state = {
    ...state,
    status: GameStatus.Ready,
    players: {
      0: { seat: 0, role: 'wolf', hasViewedRole: true },
      1: { seat: 1, role: 'seer', hasViewedRole: true },
      2: { seat: 2, role: 'villager', hasViewedRole: true },
    },
  };
  return parseWerewolfState(JSON.parse(JSON.stringify(state)));
}

/** Rebuilds the exact document a v5 store would have persisted. */
function downgradeToV5(state: GameState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const roster = raw.roster as Record<string, { userId?: string }>;
  const players: Record<string, unknown> = {};
  for (const [key, player] of Object.entries(raw.players as Record<string, unknown>)) {
    if (player === null) {
      players[key] = null;
      continue;
    }
    const occupant = roster[key];
    const isBot = occupant !== undefined && occupant.userId === undefined;
    players[key] = {
      ...(player as Record<string, unknown>),
      userId: isBot ? `bot-${key}` : occupant?.userId,
      ...(isBot ? { isBot: true } : {}),
    };
  }
  return {
    ...raw,
    stateVersion: 5,
    players,
    roster: raw.playerProfiles,
    playerProfiles: undefined,
  };
}

describe('Werewolf v5 -> v6 roster migration', () => {
  it('splits a started game (2 humans + 1 bot, roles assigned) exactly', () => {
    const state = buildV6State();
    const legacy = downgradeToV5(state);
    delete legacy.playerProfiles;
    expect(() => parseWerewolfState(legacy)).toThrow();
    const migrated = migratePersistedWerewolfState(legacy);
    expect(migrated).toEqual(state);
    expect(migrated.roster[2]).toEqual({ seat: 2, kind: 'bot' });
    expect(migrated.roster[0]).toEqual({ seat: 0, userId: 'host' });
    expect(migrated.playerProfiles.host?.displayName).toBe('房主');
    expect(migrated.playerProfiles['bot-2']?.displayName).toBe('机器人3号');
    expect(migratePersistedWerewolfState(state)).toEqual(state);
  });

  it('migrates sparse players and an explicit isBot:false whole', () => {
    // A lobby room where seat 1 was never taken; seat 0 carries the explicit
    // isBot:false the old optional field allowed.
    const lobby = parseWerewolfState(
      JSON.parse(
        JSON.stringify(
          buildInitialGameState(
            'ROOM',
            'host',
            createTemplateFromRoles(['wolf', 'seer', 'villager']),
          ),
        ),
      ),
    );
    lobby.hostUserId = 'host';
    lobby.players[0] = { seat: 0, role: null, hasViewedRole: false };
    lobby.players[2] = { seat: 2, role: null, hasViewedRole: false };
    lobby.roster = {
      0: { seat: 0, userId: 'host' },
      2: { seat: 2, kind: 'bot' },
    };
    lobby.playerProfiles = {
      host: { displayName: '房主' },
      'bot-2': { displayName: '机器人3号' },
    };
    const legacy = downgradeToV5(lobby);
    const legacyPlayers = legacy.players as Record<string, Record<string, unknown> | null>;
    const legacyHost = legacyPlayers[0];
    if (legacyHost != null) legacyHost.isBot = false;

    expect(migratePersistedWerewolfState(legacy)).toEqual(lobby);
  });

  it('migrates an empty lobby (no occupants) whole', () => {
    const state = parseWerewolfState(
      JSON.parse(
        JSON.stringify(
          buildInitialGameState('ROOM', 'host', createTemplateFromRoles(['wolf', 'seer'])),
        ),
      ),
    );
    const legacy = downgradeToV5(state);
    delete legacy.playerProfiles;
    expect(migratePersistedWerewolfState(legacy)).toEqual(state);
  });
});

describe('v6 -> current migration (debugMode deletion + nightStep shape)', () => {
  it('drops the debugMode field and parses the rest unchanged', () => {
    const current = buildV6State();
    const stored = JSON.parse(
      JSON.stringify({ ...current, stateVersion: 6, debugMode: { botsEnabled: true } }),
    ) as unknown;

    const migrated = migratePersistedWerewolfState(stored);

    expect(migrated.stateVersion).toBe(9);
    expect('debugMode' in migrated).toBe(false);
    expect(migrated).toEqual(parseWerewolfState(JSON.parse(JSON.stringify(current)) as unknown));
  });

  it('rejects a current-version payload that still carries debugMode', () => {
    const current = buildV6State();
    const stored = JSON.parse(
      JSON.stringify({ ...current, debugMode: { botsEnabled: true } }),
    ) as unknown;

    expect(() => parseWerewolfState(stored)).toThrow('GameState contains unknown field: debugMode');
  });
});

describe('v7 -> current migration (night-step canonicalization into the nightStep shape)', () => {
  // Base board is [wolf, seer, villager]: the night plan is
  // [wolfKill, seerCheck] (length 2).
  function storedV7(overrides: Record<string, unknown>): unknown {
    return JSON.parse(
      JSON.stringify({ ...buildV6State(), stateVersion: 7, ...overrides }),
    ) as unknown;
  }

  it('clears a stepDeadline that survived END_NIGHT into Ended', () => {
    const migrated = migratePersistedWerewolfState(
      storedV7({
        status: GameStatus.Ended,
        currentNightResults: {},
        currentStepIndex: 0,
        currentStepId: 'wolfKill',
        stepDeadline: 1_000,
      }),
    );
    expect(migrated.stateVersion).toBe(9);
    expect(migrated.nightStep).toBeNull();
  });

  it('clears step fields on any non-Ongoing status', () => {
    const migrated = migratePersistedWerewolfState(
      storedV7({ status: GameStatus.Seated, currentStepId: 'wolfKill', currentStepIndex: 2 }),
    );
    expect(migrated.nightStep).toBeNull();
  });

  it('repairs an Ongoing index that disagrees with its step id (the id wins)', () => {
    const migrated = migratePersistedWerewolfState(
      storedV7({
        status: GameStatus.Ongoing,
        currentNightResults: {},
        currentStepId: 'seerCheck',
        currentStepIndex: 0,
        stepDeadline: 2_000,
      }),
    );
    expect(migrated.nightStep).toEqual({
      kind: 'inStep',
      stepId: 'seerCheck',
      stepDeadline: 2_000,
    });
  });

  it('normalizes the exhausted position to the plan length and drops its deadline', () => {
    const migrated = migratePersistedWerewolfState(
      storedV7({
        status: GameStatus.Ongoing,
        currentNightResults: {},
        currentStepIndex: 0,
        stepDeadline: 3_000,
      }),
    );
    expect(migrated.nightStep).toEqual({ kind: 'exhausted' });
  });

  it('passes a consistent in-step Ongoing state through value-identical', () => {
    const migrated = migratePersistedWerewolfState(
      storedV7({
        status: GameStatus.Ongoing,
        currentNightResults: {},
        currentStepId: 'wolfKill',
        currentStepIndex: 0,
        stepDeadline: 4_000,
      }),
    );
    expect(migrated.nightStep).toEqual({
      kind: 'inStep',
      stepId: 'wolfKill',
      stepDeadline: 4_000,
    });
  });

  it('rescues a step id outside the plan from the stored index position', () => {
    const migrated = migratePersistedWerewolfState(
      storedV7({
        status: GameStatus.Ongoing,
        currentNightResults: {},
        currentStepId: 'guardProtect',
        currentStepIndex: 1,
      }),
    );
    expect(migrated.nightStep).toEqual({ kind: 'inStep', stepId: 'seerCheck' });
  });

  it('rejects a current-version (v9) payload that still carries legacy step fields', () => {
    const stored = JSON.parse(
      JSON.stringify({
        ...buildV6State(),
        status: GameStatus.Ongoing,
        currentNightResults: {},
        currentStepId: 'seerCheck',
        currentStepIndex: 0,
      }),
    ) as unknown;
    expect(() => migratePersistedWerewolfState(stored)).toThrow(/unknown field/);
  });

  it('canonicalizes a dirty v6 payload on its way to v9 as well', () => {
    const migrated = migratePersistedWerewolfState(
      storedV7({
        stateVersion: 6,
        debugMode: { botsEnabled: true },
        status: GameStatus.Ended,
        currentNightResults: {},
        stepDeadline: 5_000,
      }),
    );
    expect(migrated.stateVersion).toBe(9);
    expect('debugMode' in migrated).toBe(false);
    expect(migrated.nightStep).toBeNull();
  });
});

describe('v8 -> v9 migration (legacy step fields into the nightStep shape)', () => {
  // Base board is [wolf, seer, villager]: the night plan is
  // [wolfKill, seerCheck] (length 2). A v8 document carries the legacy
  // three fields and no nightStep key.
  function storedV8(overrides: Record<string, unknown>): unknown {
    const raw = JSON.parse(JSON.stringify(buildV6State())) as Record<string, unknown>;
    delete raw.nightStep;
    return { ...raw, stateVersion: 8, ...overrides };
  }

  it('clears an Ended residual step window (incl. deadline) into nightStep null', () => {
    const migrated = migratePersistedWerewolfState(
      storedV8({
        status: GameStatus.Ended,
        currentNightResults: {},
        currentStepIndex: 0,
        currentStepId: 'wolfKill',
        stepDeadline: 1_000,
      }),
    );
    expect(migrated.stateVersion).toBe(9);
    expect(migrated.nightStep).toBeNull();
  });

  it('maps a lobby state (L1) to nightStep null', () => {
    const migrated = migratePersistedWerewolfState(
      storedV8({
        status: GameStatus.Unseated,
        currentStepIndex: 0,
        currentStepId: 'wolfKill',
        stepDeadline: 1_000,
      }),
    );
    expect(migrated.stateVersion).toBe(9);
    expect(migrated.nightStep).toBeNull();
  });

  it('maps a Day state with a sheriff election to nightStep null and keeps the election', () => {
    const dayState = gameReducer(
      {
        ...buildV6State(),
        status: GameStatus.Ongoing,
        rules: { isSheriffElectionEnabled: true },
        currentNightResults: {},
        nightStep: { kind: 'exhausted' },
      },
      { type: 'END_NIGHT', payload: { deaths: [], deathReasons: {} } },
    );
    expect(dayState.status).toBe(GameStatus.Day);
    const raw = JSON.parse(JSON.stringify(dayState)) as Record<string, unknown>;
    delete raw.nightStep;
    const migrated = migratePersistedWerewolfState({
      ...raw,
      stateVersion: 8,
      currentStepIndex: -1,
    });
    expect(migrated.stateVersion).toBe(9);
    expect(migrated.status).toBe(GameStatus.Day);
    expect(migrated.nightStep).toBeNull();
    expect(migrated.sheriffElection).toEqual(dayState.sheriffElection);
  });

  it('maps an Ongoing step id into inStep, the id winning over a stale index', () => {
    const migrated = migratePersistedWerewolfState(
      storedV8({
        status: GameStatus.Ongoing,
        currentNightResults: {},
        currentStepId: 'seerCheck',
        currentStepIndex: 0,
        stepDeadline: 2_000,
      }),
    );
    expect(migrated.nightStep).toEqual({
      kind: 'inStep',
      stepId: 'seerCheck',
      stepDeadline: 2_000,
    });
  });

  it('maps an Ongoing state without a step id to exhausted and drops its deadline', () => {
    const migrated = migratePersistedWerewolfState(
      storedV8({
        status: GameStatus.Ongoing,
        currentNightResults: {},
        currentStepIndex: 2,
        stepDeadline: 3_000,
      }),
    );
    expect(migrated.nightStep).toEqual({ kind: 'exhausted' });
  });

  it('passes a consistent in-step Ongoing state through value-identical', () => {
    const migrated = migratePersistedWerewolfState(
      storedV8({
        status: GameStatus.Ongoing,
        currentNightResults: {},
        currentStepId: 'wolfKill',
        currentStepIndex: 0,
        stepDeadline: 4_000,
      }),
    );
    expect(migrated.nightStep).toEqual({
      kind: 'inStep',
      stepId: 'wolfKill',
      stepDeadline: 4_000,
    });
  });
});
