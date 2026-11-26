import {
  type DecryptoCommand,
  decryptoEngine,
  type DecryptoState,
  type DecryptoTeam,
  DEFAULT_DECRYPTO_CONFIG,
  parseDecryptoState,
} from '@game-judge/game-engine/games/decrypto/public';
import { describe, expect, it } from 'vitest';

import { buildTakeoverViewResponse, resolveTakeoverSeat } from '../wordRoutes';

function sendCommand(
  state: DecryptoState,
  command: DecryptoCommand,
  actor:
    | { readonly kind: 'user'; readonly userId: string }
    | { readonly kind: 'system'; readonly effectId: string },
): DecryptoState {
  const commandId = `test:${command.type}`;
  const commandContext =
    actor.kind === 'user'
      ? {
          actor,
          controlledSeat: null,
          nowMs: 1_000,
          commandId,
          randomSeed: commandId,
        }
      : {
          actor,
          controlledSeat: null,
          nowMs: 1_000,
          commandId,
          randomSeed: commandId,
        };
  const decision = decryptoEngine.decide(state, command, commandContext);
  if (decision.kind === 'reject') throw new Error(`Unexpected rejection: ${decision.reason}`);
  return decision.events.reduce(decryptoEngine.evolve, state);
}

function createPlayingState(): DecryptoState {
  let state = decryptoEngine.createInitialState(
    { ...DEFAULT_DECRYPTO_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1_000, commandId: 'create' },
  );
  state = sendCommand(
    state,
    { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } },
    { kind: 'user', userId: 'host' },
  );
  state = sendCommand(state, { type: 'room.seat.fillBots' }, { kind: 'user', userId: 'host' });
  state = sendCommand(state, { type: 'decrypto.game.begin' }, { kind: 'user', userId: 'host' });
  state = sendCommand(state, { type: 'decrypto.teams.confirm' }, { kind: 'user', userId: 'host' });
  if (state.phase.kind !== 'preparing') throw new Error('Expected word preparation');
  const teamKeywords: Readonly<Record<DecryptoTeam, readonly [string, string, string, string]>> = {
    blue: ['苹果', '桥梁', '火山', '钢琴'],
    purple: ['月亮', '雨伞', '沙漠', '冰箱'],
  };
  return sendCommand(
    state,
    {
      type: 'decrypto.words.selected',
      requestId: state.phase.requestId,
      keywords: teamKeywords,
    },
    { kind: 'system', effectId: 'word-selection' },
  );
}

describe('Decrypto takeover private view access', () => {
  it('only resolves a bot seat for the host', () => {
    const state = createPlayingState();
    const botSeat = Object.keys(state.roster)
      .map(Number)
      .find((seat) => seat !== 0);
    if (botSeat === undefined) throw new Error('Expected a bot seat');

    expect(resolveTakeoverSeat(state, 'host', botSeat)).toBe(botSeat);
    expect(() => resolveTakeoverSeat(state, 'guest', botSeat)).toThrow('NOT_HOST');
    expect(() => resolveTakeoverSeat(state, 'host', 0)).toThrow('CONTROLLED_SEAT_NOT_BOT');
  });

  it('returns the bot team words and only its encryptor code, never the opposing private view', async () => {
    const state = createPlayingState();
    if (state.phase.kind !== 'playing') throw new Error('Expected active gameplay');
    const game = state.phase.game;
    for (const botSeat of Object.keys(game.assignments)
      .map(Number)
      .filter((seat) => seat !== 0)) {
      expect(resolveTakeoverSeat(state, 'host', botSeat)).toBe(botSeat);
      const team = game.assignments[botSeat];
      if (team === undefined) throw new Error('Bot seat has no team');
      const otherTeam = team === 'blue' ? 'purple' : 'blue';
      const response = buildTakeoverViewResponse(state, botSeat);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      const body = await response.json<{ seat: number; state: unknown }>();
      const projected = parseDecryptoState(body.state);
      if (projected.phase.kind !== 'playing') throw new Error('Expected bot playing view');
      expect(body.seat).toBe(botSeat);
      expect(projected.phaseRevision).toBe(state.phaseRevision);
      expect(projected.phase.game.keywords?.[team]).toEqual(game.keywords?.[team]);
      expect(projected.phase.game.keywords?.[otherTeam]).not.toEqual(game.keywords?.[otherTeam]);
      expect(projected.phase.game.codes[team]).toEqual(
        game.encryptors?.[team] === botSeat ? game.codes[team] : [1, 1, 1],
      );
      expect(projected.phase.game.codes[otherTeam]).toEqual([1, 1, 1]);
    }
  });

  it('rejects unassigned seats and requests outside active play', () => {
    const state = createPlayingState();
    expect(() => buildTakeoverViewResponse(state, 99)).toThrow('DECRYPTO_SEAT_NOT_ASSIGNED');
    expect(() => buildTakeoverViewResponse({ ...state, phase: { kind: 'lobby' } }, 1)).toThrow(
      'DECRYPTO_KEYWORDS_NOT_READY',
    );
  });
});
