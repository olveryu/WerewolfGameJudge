/** v5 -> v6 player-record split migration: identity moves to the roster. */

import { GameStatus } from '../../domain/models/GameStatus';
import { createTemplateFromRoles } from '../../domain/models/Template';
import type { GameState } from '../../domain/protocol/types';
import { gameReducer } from '../../domain/reducer/gameReducer';
import { buildInitialGameState } from '../../domain/state/buildInitialState';
import { migratePersistedWerewolfState, parseWerewolfState } from '../parseState';

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
