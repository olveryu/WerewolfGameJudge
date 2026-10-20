/**
 * Werewolf engine mainline (AU-44): lobby → assign → viewing
 * checkpoint → night start, driven through authoritative commands
 * on the shared session harness with the parser round-trip.
 *
 * The sibling engine.test.ts is the handler/decision unit suite:
 * it constructs mid-game states directly to pin handler and
 * resolver behavior in isolation (registered exception to the
 * no-injection rule — those tests target units below the decide
 * mainline). This suite covers the decide mainline itself.
 */

import { describe, expect, it } from 'vitest';

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { REASON_NOT_HOST } from '../../../platform/protocol/reasons';
import { GameStatus } from '../domain/models/GameStatus';
import { werewolfEngine } from '../engine';
import { parseWerewolfState } from '../state/parseState';

describe('Werewolf engine mainline', () => {
  it('runs lobby → assign → viewing checkpoint → night start through commands only', () => {
    const session = createEngineSession(werewolfEngine, {
      config: { templateRoles: ['wolf', 'seer', 'hunter', 'villager'] },
      parse: parseWerewolfState,
    });
    expect(session.state.status).toBe(GameStatus.Unseated);

    session.send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } }, 'host');
    session.send({ type: 'room.seat.take', seat: 1, profile: { displayName: 'User 1' } }, 'user-1');
    session.send({ type: 'room.seat.fillBots' }, 'host');

    // Only the host may assign roles.
    session.expectReject({ type: 'werewolf.roles.assign' }, REASON_NOT_HOST, 'user-1');
    session.send({ type: 'werewolf.roles.assign' }, 'host');
    expect(session.state.status).toBe(GameStatus.Assigned);
    const players = session.state.players;
    expect(Object.values(players).every((player) => player !== null && !player.hasViewedRole)).toBe(
      true,
    );

    // Humans view their own roles; the checkpoint holds for the bots.
    session.send({ type: 'werewolf.role.viewed' }, 'host');
    session.send({ type: 'werewolf.role.viewed' }, 'user-1');
    expect(session.state.status).toBe(GameStatus.Assigned);

    // The host scaffold action fills the bot records; that releases it.
    session.send({ type: 'werewolf.bots.markAllBotsViewed' }, 'host');
    expect(session.state.status).toBe(GameStatus.Ready);

    session.send({ type: 'werewolf.game.begin' }, 'host');
    expect(session.state.status).toBe(GameStatus.Ongoing);
    expect(werewolfEngine.getLifecycle(session.state)).toBe('ongoing');
  });
});
