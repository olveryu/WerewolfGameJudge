/** Avalon Worker boundary tests: strict create-config and public-command schemas. */

import type { AvalonPublicCommand } from '@game-judge/game-engine/games/avalon/public';
import { describe, expect, it } from 'vitest';

import { avalonWorkerModule } from '../module';
import { avalonCreateConfigSchema, avalonPublicCommandSchema } from '../schemas';

describe('Avalon create config schema', () => {
  it('accepts 5-10 players with all fields required (no schema defaults)', () => {
    for (const numberOfPlayers of [5, 6, 7, 8, 9, 10] as const) {
      expect(
        avalonCreateConfigSchema.parse({
          numberOfPlayers,
          voteMode: 'public',
          vetoLimit: 5,
        }),
      ).toEqual({ numberOfPlayers, voteMode: 'public', vetoLimit: 5 });
    }
    expect(avalonCreateConfigSchema.safeParse({ numberOfPlayers: 7 }).success).toBe(false);
    expect(
      avalonCreateConfigSchema.safeParse({ numberOfPlayers: 7, voteMode: 'secret' }).success,
    ).toBe(false);
  });

  it('rejects out-of-range player counts, illegal values and extra fields', () => {
    expect(avalonCreateConfigSchema.safeParse({ numberOfPlayers: 4 }).success).toBe(false);
    expect(avalonCreateConfigSchema.safeParse({ numberOfPlayers: 11 }).success).toBe(false);
    expect(avalonCreateConfigSchema.safeParse({ numberOfPlayers: 7.5 }).success).toBe(false);
    expect(
      avalonCreateConfigSchema.safeParse({ numberOfPlayers: 7, voteMode: 'open' }).success,
    ).toBe(false);
    expect(avalonCreateConfigSchema.safeParse({ numberOfPlayers: 7, vetoLimit: 2 }).success).toBe(
      false,
    );
    expect(avalonCreateConfigSchema.safeParse({ numberOfPlayers: 7, vetoLimit: 6 }).success).toBe(
      false,
    );
    expect(avalonCreateConfigSchema.safeParse({ numberOfPlayers: 7, extra: true }).success).toBe(
      false,
    );
  });

  it('creates the initial lobby state through the module', () => {
    const created = avalonWorkerModule.createInitialState(
      { numberOfPlayers: 6, voteMode: 'public', vetoLimit: 5 },
      { roomCode: '1234', hostUserId: 'host-1', nowMs: 1, commandId: 'create' },
    );
    if (created.kind !== 'created') throw new Error(created.reason);
    expect(created.state.phase).toEqual({ kind: 'lobby' });
    expect(created.state.config).toEqual({
      numberOfPlayers: 6,
      voteMode: 'public',
      vetoLimit: 5,
    });
  });
});

describe('Avalon public command schema', () => {
  it('accepts every §6.1 command with exact payloads', () => {
    const commands: readonly AvalonPublicCommand[] = [
      {
        type: 'avalon.config.update',
        config: { numberOfPlayers: 8, voteMode: 'secret', vetoLimit: 4 },
      },
      { type: 'avalon.game.start' },
      { type: 'avalon.game.returnToLobby' },
      { type: 'avalon.night.confirm' },
      { type: 'avalon.team.propose', seats: [0, 1, 2] },
      { type: 'avalon.team.vote', vote: 'approve' },
      { type: 'avalon.team.vote', vote: 'reject' },
      { type: 'avalon.vote.finish' },
      { type: 'avalon.quest.play', play: 'success' },
      { type: 'avalon.quest.play', play: 'fail' },
      { type: 'avalon.quest.finish' },
      { type: 'avalon.lady.check', seat: 3 },
      { type: 'avalon.lady.acknowledge' },
      { type: 'avalon.assassin.accuse', seat: 2 },
      { type: 'avalon.assassin.earlyStrike', seat: 4 },
      { type: 'room.seat.take', seat: 0, profile: { displayName: '玩家' } },
      { type: 'room.seat.fillBots' },
    ];
    for (const command of commands) {
      expect(avalonPublicCommandSchema.parse(command)).toEqual(command);
    }
  });

  it('rejects unknown commands, extra fields and mistyped payloads', () => {
    expect(avalonPublicCommandSchema.safeParse({ type: 'avalon.game.fly' }).success).toBe(false);
    expect(
      avalonPublicCommandSchema.safeParse({ type: 'avalon.game.start', extra: 1 }).success,
    ).toBe(false);
    expect(
      avalonPublicCommandSchema.safeParse({ type: 'avalon.team.vote', vote: 'yes' }).success,
    ).toBe(false);
    expect(
      avalonPublicCommandSchema.safeParse({ type: 'avalon.quest.play', play: 'maybe' }).success,
    ).toBe(false);
    expect(
      avalonPublicCommandSchema.safeParse({ type: 'avalon.team.propose', seats: [0.5] }).success,
    ).toBe(false);
    expect(avalonPublicCommandSchema.safeParse({ type: 'avalon.lady.check' }).success).toBe(false);
    expect(
      avalonPublicCommandSchema.safeParse({
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: '玩家' },
        actorUserId: 'impersonation',
      }).success,
    ).toBe(false);
  });
});
