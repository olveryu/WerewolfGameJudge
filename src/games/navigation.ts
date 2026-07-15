/** Exhaustive composition of game-owned root-navigation definitions. */

import { type GameType, parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import type {
  GameNavigationRouteKind,
  SupportedGameNavigationRoute,
} from '@/features/navigation/model/GameNavigationContribution';
import { parseRouteParams } from '@/features/navigation/model/routeParams';
import { CLIENT_GAME_PLUGIN_CATALOG } from '@/games/catalog';

type RouteParams<TDefinition> =
  TDefinition extends SupportedGameNavigationRoute<infer TParams> ? TParams : never;

type RegisteredRouteParams<TRouteKind extends GameNavigationRouteKind> = {
  [TGameType in GameType]: RouteParams<
    (typeof CLIENT_GAME_PLUGIN_CATALOG)[TGameType]['navigation'][TRouteKind]
  >;
}[GameType];

export type GameConfigRouteParams = RegisteredRouteParams<'config'>;
export type GameGuideRouteParams = RegisteredRouteParams<'guide'>;
export type GameNotepadRouteParams = RegisteredRouteParams<'notepad'>;

function getSupportedRouteDefinition(
  routeKind: GameNavigationRouteKind,
  params: unknown,
): SupportedGameNavigationRoute {
  const routeParams = parseRouteParams(params, `Game ${routeKind}`);
  const gameType = parseGameType(routeParams.gameType);
  const definition = CLIENT_GAME_PLUGIN_CATALOG[gameType].navigation[routeKind];
  if (definition.kind === 'unsupported') {
    throw new Error(`[FAIL-FAST] ${gameType} does not support ${routeKind} navigation`);
  }
  return definition;
}

export function parseGameNavigationRouteParams(
  routeKind: GameNavigationRouteKind,
  params: unknown,
): object {
  return getSupportedRouteDefinition(routeKind, params).parseParams(params);
}

export function getGameNavigationRoomCode(
  routeKind: GameNavigationRouteKind,
  params: unknown,
): string | null {
  const routeParams = parseGameNavigationRouteParams(routeKind, params);
  if (!('roomCode' in routeParams) || routeParams.roomCode === undefined) return null;
  return parseRoomCode(routeParams.roomCode);
}
