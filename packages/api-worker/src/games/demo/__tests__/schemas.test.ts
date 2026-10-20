/** Demo Worker boundary tests: strict create-config and public-command schemas. */

import { describe, expect, it } from 'vitest';

import { demoWorkerModule } from '../module';
import {
  demoCreateConfigSchema,
  demoInternalCommandSchema,
  demoPublicCommandSchema,
} from '../schemas';

describe('Demo create config schema', () => {
  it('accepts player counts inside the supported range', () => {
    for (const numberOfPlayers of [4, 6, 12]) {
      expect(demoCreateConfigSchema.parse({ numberOfPlayers })).toEqual({
        numberOfPlayers,
      });
    }
  });

  it('rejects out-of-range counts, missing fields and extra fields', () => {
    expect(demoCreateConfigSchema.safeParse({ numberOfPlayers: 3 }).success).toBe(false);
    expect(demoCreateConfigSchema.safeParse({ numberOfPlayers: 13 }).success).toBe(false);
    expect(demoCreateConfigSchema.safeParse({ numberOfPlayers: 7.5 }).success).toBe(false);
    expect(demoCreateConfigSchema.safeParse({}).success).toBe(false);
    expect(demoCreateConfigSchema.safeParse({ numberOfPlayers: 6, extra: true }).success).toBe(
      false,
    );
  });

  it('creates the initial lobby state through the module', () => {
    const created = demoWorkerModule.createInitialState(
      { numberOfPlayers: 6 },
      { roomCode: '1234', hostUserId: 'host-1', nowMs: 1, commandId: 'create' },
    );
    if (created.kind !== 'created') throw new Error(created.reason);
    expect(created.state.phase).toEqual({ kind: 'lobby' });
    expect(created.state.config).toEqual({ numberOfPlayers: 6 });
  });
});

describe('Demo public command schema', () => {
  it('accepts the room commands and the game commands with exact payloads', () => {
    const accepted: unknown[] = [
      {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: 'P0' },
      },
      { type: 'room.seat.leave' },
      { type: 'room.seat.fillBots' },
      { type: 'demo.config.update', config: { numberOfPlayers: 6 } },
      { type: 'demo.roles.assign' },
      { type: 'demo.game.begin' },
      { type: 'demo.role.viewed' },
      { type: 'demo.bots.markAllBotsViewed' },
      { type: 'demo.game.returnToLobby' },
      { type: 'demo.gameplay.example' },
    ];
    for (const command of accepted) {
      expect(demoPublicCommandSchema.safeParse(command).success).toBe(true);
    }
  });

  it('rejects unknown commands, extra fields and worker-internal commands', () => {
    expect(demoPublicCommandSchema.safeParse({ type: 'demo.nope' }).success).toBe(false);
    expect(demoPublicCommandSchema.safeParse({ type: 'demo.roles.assign', extra: 1 }).success).toBe(
      false,
    );
    expect(demoInternalCommandSchema.safeParse({ type: 'anything' }).success).toBe(false);
  });
});
