/** Game-neutral root routes resolved from bound navigation capabilities. */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseGameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type React from 'react';

import type { GameNavigationRouteKind } from '@/features/navigation/model/GameNavigationContribution';
import { useClientGameCatalog } from '@/games/ClientGameCatalogContext';
import { getClientGameModule } from '@/games/model/ClientGameCatalog';

import type { RootStackParamList } from './types';

interface GameHostScreenProps {
  readonly routeKind: GameNavigationRouteKind;
  readonly params: unknown;
  readonly gameType: unknown;
}

const GameHostScreen: React.FC<GameHostScreenProps> = ({ routeKind, params, gameType: input }) => {
  const catalog = useClientGameCatalog();
  const gameType = parseGameType(input);
  const navigation = getClientGameModule(catalog, gameType).navigation;
  if (navigation.gameType !== gameType) {
    throw new Error(
      `[FAIL-FAST] Client module ${gameType} registered ${navigation.gameType} navigation`,
    );
  }

  const capability = navigation[routeKind];
  if (capability.kind === 'unsupported') {
    throw new Error(`[FAIL-FAST] ${gameType} does not support ${routeKind} navigation`);
  }
  capability.parseParams(params);
  return <capability.Screen />;
};

export const GameConfigHostRoute: React.FC<
  NativeStackScreenProps<RootStackParamList, 'GameConfig'>
> = ({ route }) => (
  <GameHostScreen routeKind="config" params={route.params} gameType={route.params.gameType} />
);

export const GameGuideHostRoute: React.FC<
  NativeStackScreenProps<RootStackParamList, 'GameGuide'>
> = ({ route }) => (
  <GameHostScreen routeKind="guide" params={route.params} gameType={route.params.gameType} />
);

export const GameNotepadHostRoute: React.FC<
  NativeStackScreenProps<RootStackParamList, 'GameNotepad'>
> = ({ route }) => (
  <GameHostScreen routeKind="notepad" params={route.params} gameType={route.params.gameType} />
);
