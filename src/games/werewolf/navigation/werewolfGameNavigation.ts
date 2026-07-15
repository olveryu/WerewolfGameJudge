/** Werewolf root-navigation definition and strict route parsers. */

import { isValidRoleId, type RoleId } from '@werewolf/game-engine/games/werewolf/public';
import { parseGameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@werewolf/game-engine/platform/protocol/roomCode';

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';

import type {
  WerewolfGuideRouteParams,
  WerewolfGuideTab,
  WerewolfNotepadRouteParams,
} from './types';
import { parseWerewolfConfigRouteParams } from './werewolfConfigFlow';

function parseGuideTab(value: unknown): WerewolfGuideTab | undefined {
  if (value === undefined || value === 'roles' || value === 'boards') return value;
  if (typeof value !== 'string') {
    throw new Error('[FAIL-FAST] Werewolf guide tab must be a string');
  }
  throw new Error(`[FAIL-FAST] Unknown Werewolf guide tab: ${value}`);
}

function parseGuideRoleId(value: unknown): RoleId | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error('[FAIL-FAST] Werewolf guide role must be a string');
  }
  if (!isValidRoleId(value)) {
    throw new Error(`[FAIL-FAST] Unknown Werewolf guide role: ${value}`);
  }
  return value;
}

export function parseWerewolfGuideRouteParams(params: unknown): WerewolfGuideRouteParams {
  const routeParams = parseRouteParams(params, 'Werewolf guide');
  const gameType = parseGameType(routeParams.gameType);
  if (gameType !== 'werewolf') {
    throw new Error(`[FAIL-FAST] Werewolf guide received game type ${gameType}`);
  }
  assertExactRouteParamKeys(
    routeParams,
    ['gameType', 'roomCode', 'roleId', 'initialTab'],
    'Werewolf guide',
  );

  const roomCode =
    routeParams.roomCode === undefined ? undefined : parseRoomCode(routeParams.roomCode);
  return {
    gameType,
    roomCode,
    roleId: parseGuideRoleId(routeParams.roleId),
    initialTab: parseGuideTab(routeParams.initialTab),
  };
}

export function parseWerewolfNotepadRouteParams(params: unknown): WerewolfNotepadRouteParams {
  const routeParams = parseRouteParams(params, 'Werewolf notepad');
  const gameType = parseGameType(routeParams.gameType);
  if (gameType !== 'werewolf') {
    throw new Error(`[FAIL-FAST] Werewolf notepad received game type ${gameType}`);
  }
  assertExactRouteParamKeys(routeParams, ['gameType', 'roomCode'], 'Werewolf notepad');
  return { gameType, roomCode: parseRoomCode(routeParams.roomCode) };
}

export const werewolfGameNavigation = defineGameNavigation({
  gameType: 'werewolf',
  config: {
    kind: 'screen',
    parseParams: parseWerewolfConfigRouteParams,
  },
  guide: {
    kind: 'screen',
    parseParams: parseWerewolfGuideRouteParams,
  },
  notepad: {
    kind: 'screen',
    parseParams: parseWerewolfNotepadRouteParams,
  },
});
