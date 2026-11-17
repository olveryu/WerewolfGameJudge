/** Spotmatch Worker boundary tests: strict create-config and public-command schemas. */

import { describe, expect, it } from 'vitest';

import { spotmatchWorkerModule } from '../module';
import { spotmatchCreateConfigSchema, spotmatchPublicCommandSchema } from '../schemas';

describe('Spotmatch create config schema', () => {
  it('accepts player counts inside the supported range', () => {
    for (const numberOfPlayers of [2, 4, 20]) {
      expect(spotmatchCreateConfigSchema.parse({ numberOfPlayers, cardsPerPlayer: 8 })).toEqual({
        numberOfPlayers,
        cardsPerPlayer: 8,
      });
    }
  });

  it('rejects out-of-range counts, missing fields and extra fields', () => {
    expect(
      spotmatchCreateConfigSchema.safeParse({ numberOfPlayers: 1, cardsPerPlayer: 8 }).success,
    ).toBe(false);
    expect(
      spotmatchCreateConfigSchema.safeParse({ numberOfPlayers: 21, cardsPerPlayer: 8 }).success,
    ).toBe(false);
    expect(
      spotmatchCreateConfigSchema.safeParse({ numberOfPlayers: 4, cardsPerPlayer: 7 }).success,
    ).toBe(false);
    expect(spotmatchCreateConfigSchema.safeParse({ numberOfPlayers: 7.5 }).success).toBe(false);
    expect(spotmatchCreateConfigSchema.safeParse({}).success).toBe(false);
    expect(spotmatchCreateConfigSchema.safeParse({ numberOfPlayers: 6, extra: true }).success).toBe(
      false,
    );
  });

  it('creates the initial lobby state through the module', () => {
    const created = spotmatchWorkerModule.createInitialState(
      { numberOfPlayers: 6, cardsPerPlayer: 8 },
      { roomCode: '1234', hostUserId: 'host-1', nowMs: 1, commandId: 'create' },
    );
    if (created.kind !== 'created') throw new Error(created.reason);
    expect(created.state.phase).toEqual({ kind: 'lobby' });
    expect(created.state.config).toEqual({ numberOfPlayers: 6, cardsPerPlayer: 8 });
  });
});

describe('Spotmatch public command schema', () => {
  it('accepts the room commands and the game commands with exact payloads', () => {
    const accepted: unknown[] = [
      {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: 'P0' },
      },
      { type: 'room.seat.leave' },
      { type: 'room.seat.fillBots' },
      { type: 'spotmatch.config.update', config: { numberOfPlayers: 6, cardsPerPlayer: 8 } },
      { type: 'spotmatch.game.begin' },
      { type: 'spotmatch.game.returnToLobby' },
      { type: 'spotmatch.game.abort' },
      {
        type: 'spotmatch.card.claim',
        roundId: 'r',
        centralInstanceId: 'c',
        topInstanceId: 't',
        symbolId: 199,
      },
    ];
    for (const command of accepted) {
      expect(spotmatchPublicCommandSchema.safeParse(command).success).toBe(true);
    }
  });

  it('rejects unknown commands, extra fields and worker-internal commands', () => {
    expect(spotmatchPublicCommandSchema.safeParse({ type: 'spotmatch.nope' }).success).toBe(false);
  });
});
