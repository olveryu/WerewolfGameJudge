/** Exhaustive root-route parameter composition for client game modules. */

import { type GameType, parseGameType } from '@werewolf/game-engine/platform/protocol/gameTypes';

import { parseRouteParams } from '@/features/navigation/model/routeParams';
import type {
  WerewolfConfigRouteParams,
  WerewolfGuideRouteExtension,
  WerewolfNotepadRouteParams,
} from '@/games/werewolf/navigation/types';
import { parseWerewolfConfigRouteParams } from '@/games/werewolf/navigation/werewolfConfigFlow';

interface ClientGameRouteExtensionsByType {
  readonly werewolf: {
    readonly config: WerewolfConfigRouteParams;
    readonly guide: WerewolfGuideRouteExtension;
    readonly notepad: WerewolfNotepadRouteParams;
  };
}

type GameSpecificRouteParams<TKey extends keyof ClientGameRouteExtensionsByType[GameType]> = {
  [TGameType in GameType]: {
    readonly gameType: TGameType;
  } & ClientGameRouteExtensionsByType[TGameType][TKey];
}[GameType];

export type GameConfigRouteParams = ClientGameRouteExtensionsByType[GameType]['config'];

export type GameGuideRouteParams = {
  [TGameType in GameType]: {
    readonly gameType: TGameType;
    readonly roomCode?: string;
  } & ClientGameRouteExtensionsByType[TGameType]['guide'];
}[GameType];

export type GameNotepadRouteParams = GameSpecificRouteParams<'notepad'>;

type GameConfigRouteParser = (params: unknown) => GameConfigRouteParams;

const GAME_CONFIG_ROUTE_PARSERS = {
  werewolf: parseWerewolfConfigRouteParams,
} satisfies Readonly<Record<GameType, GameConfigRouteParser>>;

function parseGameConfigRouteParams(params: unknown): GameConfigRouteParams {
  const routeParams = parseRouteParams(params, 'Game config');
  const gameType = parseGameType(routeParams.gameType);
  return GAME_CONFIG_ROUTE_PARSERS[gameType](routeParams);
}

export function getGameConfigRoomCode(params: unknown): string | null {
  const routeParams = parseGameConfigRouteParams(params);
  return 'roomCode' in routeParams ? routeParams.roomCode : null;
}
