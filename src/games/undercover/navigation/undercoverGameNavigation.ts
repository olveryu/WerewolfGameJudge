/** Strict Undercover-owned route parsers; shared navigation hosts consume this definition. */
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';

export type UndercoverConfigRouteParams =
  | { readonly gameType: 'undercover'; readonly mode: 'create' }
  | { readonly gameType: 'undercover'; readonly mode: 'edit'; readonly roomCode: string };

export function parseUndercoverConfigRouteParams(value: unknown): UndercoverConfigRouteParams {
  const params = parseRouteParams(value, 'Undercover config');
  assertExactRouteParamKeys(params, ['gameType', 'mode', 'roomCode'], 'Undercover config');
  if (params.gameType !== 'undercover') throw new Error('Undercover config game mismatch');
  if (params.mode === 'create' && params.roomCode === undefined)
    return { gameType: 'undercover', mode: 'create' };
  if (params.mode === 'edit')
    return { gameType: 'undercover', mode: 'edit', roomCode: parseRoomCode(params.roomCode) };
  throw new Error('Invalid Undercover config route');
}

function parseUndercoverGuideRouteParams(value: unknown): {
  readonly gameType: 'undercover';
  readonly roomCode?: string;
} {
  const params = parseRouteParams(value, 'Undercover guide');
  assertExactRouteParamKeys(params, ['gameType', 'roomCode'], 'Undercover guide');
  if (params.gameType !== 'undercover') throw new Error('Undercover guide game mismatch');
  return {
    gameType: 'undercover' as const,
    roomCode: params.roomCode === undefined ? undefined : parseRoomCode(params.roomCode),
  };
}

export const undercoverGameNavigation = defineGameNavigation({
  gameType: 'undercover',
  config: { kind: 'screen', parseParams: parseUndercoverConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseUndercoverGuideRouteParams },
  notepad: { kind: 'unsupported' },
});
