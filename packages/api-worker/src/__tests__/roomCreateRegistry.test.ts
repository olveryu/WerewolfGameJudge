/**
 * roomCreateRegistry — per-gameType create config contracts.
 */

import { FIB_GAME_TYPE } from '@werewolf/game-engine/fibking/types';
import { WEREWOLF_GAME_TYPE } from '@werewolf/game-engine/protocol/gameTypes';
import { describe, expect, it } from 'vitest';

import { createInitialRoomState } from '../roomCreate/registry';

const createCtx = { roomCode: '1234', hostUserId: 'host-uid' };

describe('createInitialRoomState', () => {
  it('builds werewolf state from werewolf config', () => {
    const result = createInitialRoomState(
      WEREWOLF_GAME_TYPE,
      {
        template: {
          name: '',
          numberOfPlayers: 4,
          roles: ['wolf', 'seer', 'witch', 'villager'],
        },
      },
      createCtx,
    );

    expect(result).toMatchObject({
      success: true,
      state: {
        roomCode: '1234',
        hostUserId: 'host-uid',
        templateRoles: ['wolf', 'seer', 'witch', 'villager'],
      },
    });
  });

  it('rejects invalid werewolf config', () => {
    const result = createInitialRoomState(
      WEREWOLF_GAME_TYPE,
      {
        template: {
          name: '',
          numberOfPlayers: 8,
          roles: ['wolf', 'seer', 'witch', 'villager'],
        },
      },
      createCtx,
    );

    expect(result).toEqual({ success: false, reason: 'INVALID_CONFIG' });
  });

  it('builds fibking state from fibking config', () => {
    const result = createInitialRoomState(FIB_GAME_TYPE, { numberOfPlayers: 8 }, createCtx);

    expect(result).toMatchObject({
      success: true,
      state: {
        gameType: FIB_GAME_TYPE,
        roomCode: '1234',
        hostUserId: 'host-uid',
        numberOfPlayers: 8,
      },
    });
  });

  it('rejects unknown gameType', () => {
    const result = createInitialRoomState('draw_guess', { numberOfPlayers: 8 }, createCtx);

    expect(result).toEqual({ success: false, reason: 'UNKNOWN_GAME_TYPE' });
  });
});
