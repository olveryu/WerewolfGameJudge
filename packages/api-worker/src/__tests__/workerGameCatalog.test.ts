import {
  FIB_STATE_CODEC,
  fibEngine,
  type FibInternalCommand,
  type FibPublicCommand,
} from '@game-judge/game-engine/games/fibking/public';
import {
  werewolfEngine,
  type WerewolfInternalCommand,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { buildInitialGameState } from '@game-judge/game-engine/games/werewolf/testing';
import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { describe, expect, it } from 'vitest';

import { WORKER_GAME_CATALOG } from '../games/catalog';
import { fibEffectSchema } from '../games/fibking/effects';
import {
  FIB_PUBLIC_COMMAND_SCHEMA_OPTION_COUNT,
  fibCreateConfigSchema,
  fibInternalCommandSchema,
  fibPublicCommandSchema,
} from '../games/fibking/schemas';
import { werewolfEffectSchema } from '../games/werewolf/effects';
import {
  WEREWOLF_PUBLIC_COMMAND_SCHEMA_OPTION_COUNT,
  werewolfCreateConfigSchema,
  werewolfInternalCommandSchema,
  werewolfPublicCommandSchema,
} from '../games/werewolf/schemas';

const VALID_PUBLIC_COMMANDS = [
  { type: 'room.seat.take', seat: 0, profile: { displayName: '玩家' } },
  { type: 'room.seat.leave' },
  { type: 'room.seat.kick', seat: 0 },
  { type: 'room.seat.clear' },
  { type: 'room.seat.fillBots' },
  { type: 'room.profile.update', profile: { displayName: '新名字' } },
  { type: 'werewolf.roles.assign' },
  { type: 'werewolf.game.restart' },
  { type: 'werewolf.bots.markRolesViewed' },
  { type: 'werewolf.action.submit', input: { kind: 'skip' } },
  { type: 'werewolf.role.view' },
  { type: 'werewolf.config.update', templateRoles: ['villager'] },
  { type: 'werewolf.review.share', allowedSeats: [0] },
  {
    type: 'werewolf.board.nominate',
    displayName: '玩家',
    roles: ['villager'],
  },
  { type: 'werewolf.board.upvote', targetUserId: 'user-1' },
  { type: 'werewolf.board.withdraw' },
  { type: 'werewolf.night.start' },
  { type: 'werewolf.audio.ack' },
  { type: 'werewolf.audio.gate', isPlaying: true },
  { type: 'werewolf.progress.request' },
  { type: 'werewolf.reveal.ack' },
  { type: 'werewolf.wolfRobot.ackHunterStatus' },
  { type: 'werewolf.groupConfirm.ack' },
  { type: 'werewolf.groupConfirm.ackBots' },
] as const satisfies readonly WerewolfPublicCommand[];

const VALID_INTERNAL_COMMAND = {
  type: 'werewolf.growth.applyRosterLevels',
  levels: { 'user-1': 3 },
} as const satisfies WerewolfInternalCommand;

const VALID_FIB_PUBLIC_COMMANDS = [
  { type: 'room.seat.take', seat: 0, profile: { displayName: '玩家' } },
  { type: 'room.seat.leave' },
  { type: 'room.seat.kick', seat: 0 },
  { type: 'room.seat.clear' },
  { type: 'room.seat.fillBots' },
  { type: 'room.profile.update', profile: { displayName: '新名字' } },
  { type: 'fib.config.update', numberOfPlayers: 8 },
  { type: 'fib.round.start' },
  { type: 'fib.round.cancelPreparing' },
  { type: 'fib.round.reveal' },
] as const satisfies readonly FibPublicCommand[];

const VALID_FIB_INTERNAL_COMMAND = {
  type: 'fib.round.complete',
  roundId: 'round-1',
  word: '氤氲',
  definition: '烟气或云雾弥漫缭绕的样子。',
  source: 'local',
} as const satisfies FibInternalCommand;

describe('Worker game catalog', () => {
  it('registers exactly one Worker module for every canonical game type', () => {
    expect(Object.keys(WORKER_GAME_CATALOG)).toEqual([...GAME_TYPES]);
  });

  it('binds the concrete Werewolf engine, codec, and schemas', () => {
    const module = WORKER_GAME_CATALOG.werewolf;

    expect(module.gameType).toBe('werewolf');
    expect(module.engine).toBe(werewolfEngine);
    expect(module.createConfigSchema).toBe(werewolfCreateConfigSchema);
    expect(module.publicCommandSchema).toBe(werewolfPublicCommandSchema);
    expect(module.internalCommandSchema).toBe(werewolfInternalCommandSchema);
    expect(module.effectSchema).toBe(werewolfEffectSchema);

    const state = buildInitialGameState('1234', 'host', {
      name: 'test',
      numberOfPlayers: 1,
      roles: ['villager'],
    });
    expect(module.stateCodec.parse(state)).toEqual(state);
  });

  it('binds the concrete Fib engine, codec, and schemas', () => {
    const module = WORKER_GAME_CATALOG.fibking;

    expect(module.gameType).toBe('fibking');
    expect(module.engine).toBe(fibEngine);
    expect(module.createConfigSchema).toBe(fibCreateConfigSchema);
    expect(module.publicCommandSchema).toBe(fibPublicCommandSchema);
    expect(module.internalCommandSchema).toBe(fibInternalCommandSchema);
    expect(module.effectSchema).toBe(fibEffectSchema);

    const created = module.createInitialState(
      { numberOfPlayers: 8 },
      { roomCode: '5678', hostUserId: 'host', nowMs: 1, commandId: 'create-fib' },
    );
    if (created.kind !== 'created') throw new Error(created.reason);
    expect(FIB_STATE_CODEC.parse(created.state)).toMatchObject({
      gameType: 'fibking',
      phase: 'lobby',
      numberOfPlayers: 8,
    });
  });

  it('keeps all Werewolf public command discriminants separate from the internal schema', () => {
    expect(WEREWOLF_PUBLIC_COMMAND_SCHEMA_OPTION_COUNT).toBe(24);
    expect(VALID_PUBLIC_COMMANDS).toHaveLength(24);

    for (const command of VALID_PUBLIC_COMMANDS) {
      expect(werewolfPublicCommandSchema.parse(command)).toEqual(command);
    }
    expect(werewolfInternalCommandSchema.parse(VALID_INTERNAL_COMMAND)).toEqual(
      VALID_INTERNAL_COMMAND,
    );
    expect(() => werewolfPublicCommandSchema.parse(VALID_INTERNAL_COMMAND)).toThrow();
    expect(() => werewolfInternalCommandSchema.parse(VALID_PUBLIC_COMMANDS[0])).toThrow();
  });

  it('keeps every Fib public command separate from its internal completion command', () => {
    expect(FIB_PUBLIC_COMMAND_SCHEMA_OPTION_COUNT).toBe(10);
    expect(VALID_FIB_PUBLIC_COMMANDS).toHaveLength(10);

    for (const command of VALID_FIB_PUBLIC_COMMANDS) {
      expect(fibPublicCommandSchema.parse(command)).toEqual(command);
    }
    expect(fibInternalCommandSchema.parse(VALID_FIB_INTERNAL_COMMAND)).toEqual(
      VALID_FIB_INTERNAL_COMMAND,
    );
    expect(() => fibPublicCommandSchema.parse(VALID_FIB_INTERNAL_COMMAND)).toThrow();
    expect(() => fibInternalCommandSchema.parse(VALID_FIB_PUBLIC_COMMANDS[0])).toThrow();
  });

  it('rejects unknown command fields and malformed Werewolf role IDs', () => {
    expect(() =>
      werewolfPublicCommandSchema.parse({
        type: 'werewolf.board.withdraw',
        userId: 'client-supplied-identity',
      }),
    ).toThrow();
    expect(() =>
      werewolfPublicCommandSchema.parse({
        type: 'werewolf.config.update',
        templateRoles: ['not-a-role'],
      }),
    ).toThrow();
    expect(() =>
      werewolfPublicCommandSchema.parse({
        type: 'werewolf.action.submit',
        input: { kind: 'confirm', confirmed: false },
      }),
    ).toThrow();
  });

  it('strictly parses Werewolf create config without accepting room identity', () => {
    expect(
      werewolfCreateConfigSchema.parse({
        templateRoles: ['wolf', 'seer', 'villager', 'villager'],
        rules: { witchCanSelfHeal: true },
      }),
    ).toEqual({
      templateRoles: ['wolf', 'seer', 'villager', 'villager'],
      rules: { witchCanSelfHeal: true },
    });

    expect(() =>
      werewolfCreateConfigSchema.parse({
        roomCode: '1234',
        templateRoles: ['villager'],
      }),
    ).toThrow();
  });

  it('accepts every safe Fib player count without a product max', () => {
    expect(fibCreateConfigSchema.parse({ numberOfPlayers: Number.MAX_SAFE_INTEGER })).toEqual({
      numberOfPlayers: Number.MAX_SAFE_INTEGER,
    });
    expect(() => fibCreateConfigSchema.parse({ numberOfPlayers: 3 })).toThrow();
    expect(() => fibCreateConfigSchema.parse({ numberOfPlayers: 8.5 })).toThrow();
    expect(() =>
      fibCreateConfigSchema.parse({ numberOfPlayers: Number.MAX_SAFE_INTEGER + 1 }),
    ).toThrow();
    expect(() =>
      fibCreateConfigSchema.parse({ numberOfPlayers: 8, roomCode: 'client-owned' }),
    ).toThrow();
  });
});
