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
import { GAME_TYPES } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { describe, expect, it } from 'vitest';

import { WORKER_GAME_CATALOG, WORKER_GAME_HTTP_ROUTES } from '../catalog';
import { fibEffectSchema } from '../fibking/effects';
import {
  fibCreateConfigSchema,
  fibInternalCommandSchema,
  fibPublicCommandSchema,
} from '../fibking/schemas';
import { werewolfAiChatRoutes } from '../werewolf/aiChat/routes';
import { werewolfEffectSchema } from '../werewolf/effects';
import {
  werewolfCreateConfigSchema,
  werewolfInternalCommandSchema,
  werewolfPublicCommandSchema,
} from '../werewolf/schemas';

const VALID_PUBLIC_COMMAND_BY_TYPE = {
  'room.seat.take': { type: 'room.seat.take', seat: 0, profile: { displayName: '玩家' } },
  'room.seat.leave': { type: 'room.seat.leave' },
  'room.seat.kick': { type: 'room.seat.kick', seat: 0 },
  'room.seat.clear': { type: 'room.seat.clear' },
  'room.seat.fillBots': { type: 'room.seat.fillBots' },
  'room.profile.update': {
    type: 'room.profile.update',
    profile: { displayName: '新名字' },
  },
  'werewolf.roles.assign': { type: 'werewolf.roles.assign' },
  'werewolf.game.restart': { type: 'werewolf.game.restart' },
  'werewolf.bots.markRolesViewed': { type: 'werewolf.bots.markRolesViewed' },
  'werewolf.action.submit': { type: 'werewolf.action.submit', input: { kind: 'skip' } },
  'werewolf.role.view': { type: 'werewolf.role.view' },
  'werewolf.config.update': {
    type: 'werewolf.config.update',
    templateRoles: ['villager'],
  },
  'werewolf.review.share': { type: 'werewolf.review.share', allowedSeats: [0] },
  'werewolf.board.nominate': {
    type: 'werewolf.board.nominate',
    displayName: '玩家',
    roles: ['villager'],
  },
  'werewolf.board.upvote': { type: 'werewolf.board.upvote', targetUserId: 'user-1' },
  'werewolf.board.withdraw': { type: 'werewolf.board.withdraw' },
  'werewolf.night.start': { type: 'werewolf.night.start' },
  'werewolf.audio.ack': { type: 'werewolf.audio.ack' },
  'werewolf.progress.request': { type: 'werewolf.progress.request' },
  'werewolf.reveal.ack': { type: 'werewolf.reveal.ack' },
  'werewolf.wolfRobot.ackHunterStatus': { type: 'werewolf.wolfRobot.ackHunterStatus' },
  'werewolf.groupConfirm.ack': { type: 'werewolf.groupConfirm.ack' },
  'werewolf.groupConfirm.ackBots': { type: 'werewolf.groupConfirm.ackBots' },
} as const satisfies {
  readonly [Type in WerewolfPublicCommand['type']]: Extract<
    WerewolfPublicCommand,
    { readonly type: Type }
  >;
};

const VALID_INTERNAL_COMMAND = {
  type: 'werewolf.growth.applyRosterLevels',
  levels: { 'user-1': 3 },
} as const satisfies WerewolfInternalCommand;

const VALID_FIB_PUBLIC_COMMAND_BY_TYPE = {
  'room.seat.take': { type: 'room.seat.take', seat: 0, profile: { displayName: '玩家' } },
  'room.seat.leave': { type: 'room.seat.leave' },
  'room.seat.kick': { type: 'room.seat.kick', seat: 0 },
  'room.seat.clear': { type: 'room.seat.clear' },
  'room.seat.fillBots': { type: 'room.seat.fillBots' },
  'room.profile.update': {
    type: 'room.profile.update',
    profile: { displayName: '新名字' },
  },
  'fib.config.update': { type: 'fib.config.update', numberOfPlayers: 8 },
  'fib.round.start': { type: 'fib.round.start' },
  'fib.round.cancelPreparing': { type: 'fib.round.cancelPreparing' },
  'fib.round.reveal': { type: 'fib.round.reveal' },
} as const satisfies {
  readonly [Type in FibPublicCommand['type']]: Extract<FibPublicCommand, { readonly type: Type }>;
};

const VALID_FIB_INTERNAL_COMMAND_BY_TYPE = {
  'fib.round.updatePreparationStage': {
    type: 'fib.round.updatePreparationStage',
    roundId: 'round-1',
    stage: 'selectingWord',
  },
  'fib.round.failPreparation': {
    type: 'fib.round.failPreparation',
    roundId: 'round-1',
    failureCode: 'unexpected-error',
  },
  'fib.round.complete': {
    type: 'fib.round.complete',
    roundId: 'round-1',
    catalogEntryId: 'fib-0001',
    catalogVersion: 1,
    word: '氤氲',
    definition: {
      coreMeaning: '烟气或云雾弥漫缭绕的样子。',
      usageNote: '常用于描写水汽、烟雾或气氛缓慢弥散的状态。',
    },
  },
} as const satisfies {
  readonly [Type in FibInternalCommand['type']]: Extract<
    FibInternalCommand,
    { readonly type: Type }
  >;
};

describe('Worker game catalog', () => {
  it('registers exactly one Worker module for every canonical game type', () => {
    expect(Object.keys(WORKER_GAME_CATALOG)).toEqual([...GAME_TYPES]);
  });

  it('projects game-owned HTTP routes from the same catalog', () => {
    expect(WORKER_GAME_HTTP_ROUTES).toEqual([
      {
        gameType: 'werewolf',
        path: '/api/games/werewolf/ai-chat',
        router: werewolfAiChatRoutes,
      },
    ]);
    expect(WORKER_GAME_CATALOG.fibking.httpRoutes).toEqual([]);
  });

  it('binds the concrete Werewolf engine, codec, and schemas', () => {
    const module = WORKER_GAME_CATALOG.werewolf;

    expect(module.gameType).toBe('werewolf');
    expect(module.engine).toBe(werewolfEngine);
    expect(module.createConfigSchema).toBe(werewolfCreateConfigSchema);
    expect(module.publicCommandSchema).toBe(werewolfPublicCommandSchema);
    expect(module.internalCommandSchema).toBe(werewolfInternalCommandSchema);
    expect(module.effectSchema).toBe(werewolfEffectSchema);

    const state = werewolfEngine.createInitialState(
      { templateRoles: ['villager'] },
      { roomCode: '1234', hostUserId: 'host', nowMs: 1, commandId: 'create-catalog-test' },
    );
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
    const publicCommands = Object.values(VALID_PUBLIC_COMMAND_BY_TYPE);

    for (const command of publicCommands) {
      expect(werewolfPublicCommandSchema.parse(command)).toEqual(command);
    }
    expect(werewolfInternalCommandSchema.parse(VALID_INTERNAL_COMMAND)).toEqual(
      VALID_INTERNAL_COMMAND,
    );
    expect(() => werewolfPublicCommandSchema.parse(VALID_INTERNAL_COMMAND)).toThrow();
    expect(() =>
      werewolfInternalCommandSchema.parse(VALID_PUBLIC_COMMAND_BY_TYPE['room.seat.take']),
    ).toThrow();
  });

  it('keeps every Fib public command separate from its internal commands', () => {
    const publicCommands = Object.values(VALID_FIB_PUBLIC_COMMAND_BY_TYPE);
    const internalCommands = Object.values(VALID_FIB_INTERNAL_COMMAND_BY_TYPE);

    for (const command of publicCommands) {
      expect(fibPublicCommandSchema.parse(command)).toEqual(command);
    }
    for (const command of internalCommands) {
      expect(fibInternalCommandSchema.parse(command)).toEqual(command);
      expect(() => fibPublicCommandSchema.parse(command)).toThrow();
    }
    expect(() =>
      fibInternalCommandSchema.parse(VALID_FIB_PUBLIC_COMMAND_BY_TYPE['room.seat.take']),
    ).toThrow();
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
