import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import { type WerewolfCommand, werewolfEngine } from '@werewolf/game-engine/games/werewolf/public';
import { describe, expect, it } from 'vitest';

import { WORKER_GAME_CATALOG } from '../games/catalog';
import {
  WEREWOLF_COMMAND_SCHEMA_OPTION_COUNT,
  werewolfCommandSchema,
  werewolfCreateConfigSchema,
} from '../games/werewolf/schemas';

const VALID_COMMANDS = [
  { type: 'room.seat.take', seat: 0, profile: { displayName: '玩家' } },
  { type: 'room.seat.leave' },
  { type: 'room.seat.kick', seat: 0 },
  { type: 'room.seat.clear' },
  { type: 'room.seat.fillBots' },
  { type: 'room.profile.update', profile: { displayName: '新名字' } },
  { type: 'werewolf.roles.assign' },
  { type: 'werewolf.game.restart' },
  { type: 'werewolf.bots.markRolesViewed' },
  { type: 'werewolf.action.submit', input: { kind: 'target', target: null } },
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
  { type: 'werewolf.growth.applyRosterLevels', levels: { 'user-1': 3 } },
] as const satisfies readonly WerewolfCommand[];

describe('Worker game catalog', () => {
  it('binds the concrete Werewolf engine, codec, and schemas', () => {
    const module = WORKER_GAME_CATALOG.werewolf;

    expect(module.gameType).toBe('werewolf');
    expect(module.engine).toBe(werewolfEngine);
    expect(module.createConfigSchema).toBe(werewolfCreateConfigSchema);
    expect(module.commandSchema).toBe(werewolfCommandSchema);

    const state = buildInitialGameState('1234', 'host', {
      name: 'test',
      numberOfPlayers: 1,
      roles: ['villager'],
    });
    expect(module.stateCodec.parse(state)).toEqual(state);
  });

  it('parses every registered command discriminant through strict schemas', () => {
    expect(WEREWOLF_COMMAND_SCHEMA_OPTION_COUNT).toBe(25);
    expect(VALID_COMMANDS).toHaveLength(25);

    for (const command of VALID_COMMANDS) {
      expect(werewolfCommandSchema.parse(command)).toEqual(command);
    }
  });

  it('rejects unknown command fields and malformed role IDs', () => {
    expect(() =>
      werewolfCommandSchema.parse({
        type: 'werewolf.board.withdraw',
        userId: 'client-supplied-identity',
      }),
    ).toThrow();
    expect(() =>
      werewolfCommandSchema.parse({
        type: 'werewolf.config.update',
        templateRoles: ['not-a-role'],
      }),
    ).toThrow();
  });

  it('strictly parses create config without accepting room identity', () => {
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
});
