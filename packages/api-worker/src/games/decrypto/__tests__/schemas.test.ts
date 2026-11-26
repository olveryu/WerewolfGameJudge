/** Decrypto Worker boundary tests: strict create-config and public-command schemas. */

import { describe, expect, it } from 'vitest';

import { decryptoWorkerModule } from '../module';
import { decryptoCreateConfigSchema, decryptoPublicCommandSchema } from '../schemas';

describe('Decrypto create config schema', () => {
  it('accepts player counts inside the supported range', () => {
    for (const numberOfPlayers of [4, 6, 8]) {
      for (const encryptorMode of ['rotating', 'fixed'] as const) {
        expect(decryptoCreateConfigSchema.parse({ numberOfPlayers, encryptorMode })).toEqual({
          numberOfPlayers,
          encryptorMode,
        });
      }
    }
  });

  it('rejects out-of-range counts, missing fields and extra fields', () => {
    expect(
      decryptoCreateConfigSchema.safeParse({ numberOfPlayers: 3, encryptorMode: 'rotating' })
        .success,
    ).toBe(false);
    expect(
      decryptoCreateConfigSchema.safeParse({ numberOfPlayers: 9, encryptorMode: 'rotating' })
        .success,
    ).toBe(false);
    expect(
      decryptoCreateConfigSchema.safeParse({ numberOfPlayers: 7.5, encryptorMode: 'rotating' })
        .success,
    ).toBe(false);
    expect(
      decryptoCreateConfigSchema.safeParse({ numberOfPlayers: 6, encryptorMode: 'invalid' })
        .success,
    ).toBe(false);
    expect(decryptoCreateConfigSchema.safeParse({ numberOfPlayers: 6 }).success).toBe(false);
    expect(decryptoCreateConfigSchema.safeParse({}).success).toBe(false);
    expect(
      decryptoCreateConfigSchema.safeParse({
        numberOfPlayers: 6,
        encryptorMode: 'rotating',
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('creates the initial lobby state through the module', () => {
    const created = decryptoWorkerModule.createInitialState(
      { numberOfPlayers: 6, encryptorMode: 'rotating' },
      { roomCode: '1234', hostUserId: 'host-1', nowMs: 1, commandId: 'create' },
    );
    if (created.kind !== 'created') throw new Error(created.reason);
    expect(created.state.phase).toEqual({ kind: 'lobby' });
    expect(created.state.config).toEqual({ numberOfPlayers: 6, encryptorMode: 'rotating' });
  });
});

describe('Decrypto public command schema', () => {
  it('accepts the room commands and the game commands with exact payloads', () => {
    const accepted: unknown[] = [
      {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: 'P0' },
      },
      { type: 'room.seat.leave' },
      { type: 'room.seat.fillBots' },
      { type: 'decrypto.config.update', config: { numberOfPlayers: 6, encryptorMode: 'rotating' } },
      { type: 'decrypto.game.begin' },
      { type: 'decrypto.teams.confirm' },
      { type: 'decrypto.game.restart', gameSequence: 1, wasEnded: false },
      { type: 'decrypto.game.restart', gameSequence: 1, wasEnded: true },
    ];
    for (const command of accepted) {
      expect(decryptoPublicCommandSchema.safeParse(command).success).toBe(true);
    }
  });

  it('rejects stale restart command forms and invalid restart payloads', () => {
    for (const command of [
      { type: 'decrypto.game.abort' },
      { type: 'decrypto.game.returnToLobby' },
      { type: 'decrypto.game.restart' },
      { type: 'decrypto.game.restart', gameSequence: 1 },
      { type: 'decrypto.game.restart', gameSequence: -1, wasEnded: false },
      { type: 'decrypto.game.restart', gameSequence: 1.5, wasEnded: false },
      { type: 'decrypto.game.restart', gameSequence: 1, wasEnded: 'false' },
      { type: 'decrypto.game.restart', gameSequence: 1, wasEnded: false, extra: true },
    ]) {
      expect(decryptoPublicCommandSchema.safeParse(command).success).toBe(false);
    }
  });

  it('rejects unknown commands, extra fields and worker-internal commands', () => {
    expect(decryptoPublicCommandSchema.safeParse({ type: 'decrypto.nope' }).success).toBe(false);
  });
});
