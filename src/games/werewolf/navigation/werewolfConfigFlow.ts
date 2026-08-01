/** Pure route-to-flow mapping for Werewolf configuration. */

import { parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';

import type { WerewolfConfigRouteParams, WerewolfConfigStackParamList } from './types';

export interface WerewolfConfigFlowStart {
  readonly initialRouteName: 'BoardPicker' | 'Config';
  readonly boardPickerParams: WerewolfConfigStackParamList['BoardPicker'];
  readonly configParams: WerewolfConfigStackParamList['Config'];
}

export function parseWerewolfConfigRouteParams(params: unknown): WerewolfConfigRouteParams {
  const routeParams = parseRouteParams(params, 'Werewolf config');
  const gameType = parseGameType(routeParams.gameType);
  if (gameType !== 'werewolf') {
    throw new Error(`[FAIL-FAST] Werewolf config received game type ${gameType}`);
  }

  const mode = routeParams.mode;
  if (typeof mode !== 'string') {
    throw new Error('[FAIL-FAST] Werewolf config mode must be a string');
  }
  switch (mode) {
    case 'create': {
      assertExactRouteParamKeys(routeParams, ['gameType', 'mode', 'roomCode'], 'Werewolf config');
      if (routeParams.roomCode !== undefined) {
        throw new Error('[FAIL-FAST] Werewolf create config must not include a room code');
      }
      return { gameType, mode };
    }
    case 'edit':
    case 'nominate': {
      assertExactRouteParamKeys(routeParams, ['gameType', 'mode', 'roomCode'], 'Werewolf config');
      return { gameType, mode, roomCode: parseRoomCode(routeParams.roomCode) };
    }
    default:
      throw new Error(`[FAIL-FAST] Unknown Werewolf config mode: ${mode}`);
  }
}

export function getWerewolfConfigFlowStart(params: unknown): WerewolfConfigFlowStart {
  const routeParams = parseWerewolfConfigRouteParams(params);
  switch (routeParams.mode) {
    case 'create':
      return {
        initialRouteName: 'BoardPicker',
        boardPickerParams: undefined,
        configParams: undefined,
      };
    case 'edit': {
      const roomCode = routeParams.roomCode;
      return {
        initialRouteName: 'Config',
        boardPickerParams: { existingRoomCode: roomCode },
        configParams: { existingRoomCode: roomCode },
      };
    }
    case 'nominate': {
      const roomCode = routeParams.roomCode;
      const nominateMode = { roomCode };
      return {
        initialRouteName: 'BoardPicker',
        boardPickerParams: { nominateMode },
        configParams: { nominateMode },
      };
    }
  }
}
