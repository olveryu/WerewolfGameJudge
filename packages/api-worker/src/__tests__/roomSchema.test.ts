/**
 * roomSchema — create-room request contracts.
 */

import { WEREWOLF_GAME_TYPE } from '@werewolf/game-engine/protocol/gameTypes';
import { describe, expect, it } from 'vitest';

import { createRoomSchema } from '../schemas/room';

describe('createRoomSchema', () => {
  it('accepts werewolf config create payload', () => {
    const result = createRoomSchema.safeParse({
      roomCode: '1234',
      gameType: WEREWOLF_GAME_TYPE,
      config: {
        template: {
          name: '',
          numberOfPlayers: 4,
          roles: ['wolf', 'seer', 'witch', 'villager'],
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts gameType config create payload', () => {
    const result = createRoomSchema.safeParse({
      roomCode: '1234',
      gameType: 'fibking',
      config: { numberOfPlayers: 8 },
    });

    expect(result.success).toBe(true);
  });

  it('rejects create without gameType', () => {
    const result = createRoomSchema.safeParse({
      roomCode: '1234',
      initialState: { roomCode: '1234' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects create without config', () => {
    const result = createRoomSchema.safeParse({
      roomCode: '1234',
      gameType: WEREWOLF_GAME_TYPE,
    });

    expect(result.success).toBe(false);
  });

  it('rejects config create without config', () => {
    const result = createRoomSchema.safeParse({
      roomCode: '1234',
      gameType: 'fibking',
    });

    expect(result.success).toBe(false);
  });

  it('rejects initialState field', () => {
    const result = createRoomSchema.safeParse({
      roomCode: '1234',
      initialState: { roomCode: '1234' },
      gameType: 'fibking',
      config: { numberOfPlayers: 8 },
    });

    expect(result.success).toBe(false);
  });
});
