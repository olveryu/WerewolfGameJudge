/** Secrethitler Worker boundary tests: strict create-config and public-command schemas. */

import { describe, expect, it } from 'vitest';

import { secrethitlerWorkerModule } from '../module';
import { secrethitlerCreateConfigSchema, secrethitlerPublicCommandSchema } from '../schemas';
import { secrethitlerInternalCommandSchema } from '../schemas';

describe('Secrethitler create config schema', () => {
  it('accepts player counts inside the supported range', () => {
    for (const numberOfPlayers of [5, 6, 10]) {
      expect(secrethitlerCreateConfigSchema.parse({ numberOfPlayers })).toEqual({
        numberOfPlayers,
      });
    }
  });

  it('rejects out-of-range counts, missing fields and extra fields', () => {
    expect(secrethitlerCreateConfigSchema.safeParse({ numberOfPlayers: 4 }).success).toBe(false);
    expect(secrethitlerCreateConfigSchema.safeParse({ numberOfPlayers: 11 }).success).toBe(false);
    expect(secrethitlerCreateConfigSchema.safeParse({ numberOfPlayers: 7.5 }).success).toBe(false);
    expect(secrethitlerCreateConfigSchema.safeParse({}).success).toBe(false);
    expect(
      secrethitlerCreateConfigSchema.safeParse({ numberOfPlayers: 6, extra: true }).success,
    ).toBe(false);
  });

  it('creates the initial lobby state through the module', () => {
    const created = secrethitlerWorkerModule.createInitialState(
      { numberOfPlayers: 6 },
      { roomCode: '1234', hostUserId: 'host-1', nowMs: 1, commandId: 'create' },
    );
    if (created.kind !== 'created') throw new Error(created.reason);
    expect(created.state.phase).toEqual({ kind: 'lobby' });
    expect(created.state.config).toEqual({ numberOfPlayers: 6 });
  });
});

describe('Secrethitler public command schema', () => {
  it('accepts the room commands and the game commands with exact payloads', () => {
    const accepted: unknown[] = [
      {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: 'P0' },
      },
      { type: 'room.seat.leave' },
      { type: 'room.seat.fillBots' },
      { type: 'secrethitler.config.update', config: { numberOfPlayers: 6 } },
      { type: 'secrethitler.roles.assign' },
      { type: 'secrethitler.game.begin' },
      { type: 'secrethitler.game.abort' },
      { type: 'secrethitler.bots.markAllBotsViewed' },
      { type: 'secrethitler.bots.markAllBotsGroupConfirmed' },
      { type: 'secrethitler.role.viewed' },
      { type: 'secrethitler.game.returnToLobby' },
      { type: 'secrethitler.night.replay', step: 1 },
      { type: 'secrethitler.night.confirm', step: 1 },
      { type: 'secrethitler.government.nominate', chancellorSeatId: 3 },
      { type: 'secrethitler.government.castVote', vote: 'ja' },
      { type: 'secrethitler.policy.presidentDiscard', policy: 'liberal' },
      { type: 'secrethitler.policy.chancellorResolve', action: 'enact', policy: 'fascist' },
      { type: 'secrethitler.policy.chancellorResolve', action: 'veto' },
      { type: 'secrethitler.policy.vetoRespond', approve: false },
      { type: 'secrethitler.action.investigate', targetSeatId: 2 },
      { type: 'secrethitler.action.specialElection', targetSeatId: 2 },
      { type: 'secrethitler.action.execute', targetSeatId: 2 },
      { type: 'secrethitler.action.acknowledgePolicyPeek' },
    ];
    for (const command of accepted) {
      expect(secrethitlerPublicCommandSchema.safeParse(command).success).toBe(true);
    }
  });

  it('rejects unknown commands, extra fields and worker-internal commands', () => {
    for (const command of [
      { type: 'secrethitler.policy.chancellorResolve', action: 'enact' },
      { type: 'secrethitler.policy.chancellorResolve', action: 'veto', policy: 'liberal' },
      { type: 'secrethitler.night.advance', step: 0 },
      { type: 'secrethitler.night.replay', step: 4 },
      { type: 'secrethitler.action.execute', targetSeatId: 10 },
      { type: 'secrethitler.government.castVote', vote: 'yes' },
    ])
      expect(secrethitlerPublicCommandSchema.safeParse(command).success).toBe(false);
    expect(secrethitlerPublicCommandSchema.safeParse({ type: 'secrethitler.nope' }).success).toBe(
      false,
    );
    expect(
      secrethitlerPublicCommandSchema.safeParse({ type: 'secrethitler.roles.assign', extra: 1 })
        .success,
    ).toBe(false);
    expect(secrethitlerInternalCommandSchema.safeParse({ type: 'anything' }).success).toBe(false);
  });
});
