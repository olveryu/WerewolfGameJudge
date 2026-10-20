import { describe, expect, it } from 'vitest';

import { REASON_FIB_ROUND_NOT_FULL } from '../../../games/fibking/domain/reasons';
import { fibEngine } from '../../../games/fibking/engine';
import { parseFibState } from '../../../games/fibking/state/parseState';
import { createEngineSession } from './engineSession';

describe('createEngineSession', () => {
  it('drives an engine through commands only, collecting effects', () => {
    const session = createEngineSession(fibEngine, { config: { numberOfPlayers: 4 } });
    expect(session.state.phase).toBe('lobby');

    session.send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
    session.send({ type: 'room.seat.fillBots' });
    const started = session.send({ type: 'fibking.roles.assign' });
    expect(started.phase).toBe('preparing');
    expect(session.effects.length).toBeGreaterThan(0);
  });

  it('throws on reject and asserts exact reasons via expectReject', () => {
    const session = createEngineSession(fibEngine, { config: { numberOfPlayers: 4 } });
    expect(() => session.send({ type: 'fibking.roles.assign' })).toThrow(
      `rejected: ${REASON_FIB_ROUND_NOT_FULL}`,
    );
    session.expectReject({ type: 'fibking.roles.assign' }, REASON_FIB_ROUND_NOT_FULL);
    // A failed send leaves the state untouched.
    expect(session.state.phase).toBe('lobby');
  });

  it('round-trips committed states through the game parser when one is given', () => {
    const session = createEngineSession(fibEngine, {
      config: { numberOfPlayers: 4 },
      parse: parseFibState,
    });
    session.send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } });
    // The held state is exactly what the persistence layer returns.
    expect(session.state).toEqual(parseFibState(JSON.parse(JSON.stringify(session.state))));
  });

  it('stamps deterministic contexts and moves only when the test moves the clock', () => {
    const session = createEngineSession(fibEngine, { config: { numberOfPlayers: 4 } });
    const first = session.context('alice');
    const second = session.context('alice');
    expect(first.commandId).not.toBe(second.commandId);
    expect(first.nowMs).toBe(1000);
    session.advance(500);
    expect(session.context('alice').nowMs).toBe(1500);
    expect(session.systemContext('word-selection').actor).toEqual({
      kind: 'system',
      effectId: 'word-selection',
    });
  });
});
