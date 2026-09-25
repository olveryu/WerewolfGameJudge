/** Story Relay route parsers; navigation hosts receive validated game-owned parameters. */

import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import { defineGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import {
  assertExactRouteParamKeys,
  parseRouteParams,
} from '@/features/navigation/model/routeParams';

export type StoryRelayConfigRouteParams =
  | { readonly gameType: 'storyrelay'; readonly mode: 'create' }
  | { readonly gameType: 'storyrelay'; readonly mode: 'edit'; readonly roomCode: string };

/** Parses only create or active-room edit settings routes. */
export function parseStoryRelayConfigRouteParams(value: unknown): StoryRelayConfigRouteParams {
  const params = parseRouteParams(value, 'Story Relay config');
  assertExactRouteParamKeys(params, ['gameType', 'mode', 'roomCode'], 'Story Relay config');
  if (params.gameType !== 'storyrelay') throw new Error('Story Relay config game mismatch');
  if (params.mode === 'create' && params.roomCode === undefined)
    return { gameType: 'storyrelay', mode: 'create' };
  if (params.mode === 'edit')
    return { gameType: 'storyrelay', mode: 'edit', roomCode: parseRoomCode(params.roomCode) };
  throw new Error('Invalid Story Relay config route');
}

function parseGuide(value: unknown): {
  readonly gameType: 'storyrelay';
  readonly roomCode?: string;
} {
  const params = parseRouteParams(value, 'Story Relay guide');
  assertExactRouteParamKeys(params, ['gameType', 'roomCode'], 'Story Relay guide');
  if (params.gameType !== 'storyrelay') throw new Error('Story Relay guide game mismatch');
  return {
    gameType: 'storyrelay' as const,
    roomCode: params.roomCode === undefined ? undefined : parseRoomCode(params.roomCode),
  };
}

export const storyRelayGameNavigation = defineGameNavigation({
  gameType: 'storyrelay',
  config: { kind: 'screen', parseParams: parseStoryRelayConfigRouteParams },
  guide: { kind: 'screen', parseParams: parseGuide },
  notepad: { kind: 'unsupported' },
});
