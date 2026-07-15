/** Game-neutral root routes that resolve screens from the client game catalog. */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseGameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type React from 'react';

import { useClientGameCatalog } from '@/games/ClientGameCatalogContext';
import { getClientGameModule } from '@/games/model/ClientGameCatalog';

import type { RootStackParamList } from './types';

export const GameConfigHostRoute: React.FC<
  NativeStackScreenProps<RootStackParamList, 'GameConfig'>
> = ({ route }) => {
  const catalog = useClientGameCatalog();
  const gameType = parseGameType(route.params.gameType);
  const Screen = getClientGameModule(catalog, gameType).navigation.configScreen;
  return <Screen />;
};

export const GameGuideHostRoute: React.FC<
  NativeStackScreenProps<RootStackParamList, 'GameGuide'>
> = ({ route }) => {
  const catalog = useClientGameCatalog();
  const gameType = parseGameType(route.params.gameType);
  const Screen = getClientGameModule(catalog, gameType).navigation.guideScreen;
  if (Screen === null) {
    throw new Error(`[FAIL-FAST] ${gameType} does not register a guide screen`);
  }
  return <Screen />;
};

export const GameNotepadHostRoute: React.FC<
  NativeStackScreenProps<RootStackParamList, 'GameNotepad'>
> = ({ route }) => {
  const catalog = useClientGameCatalog();
  const gameType = parseGameType(route.params.gameType);
  const Screen = getClientGameModule(catalog, gameType).navigation.notepadScreen;
  if (Screen === null) {
    throw new Error(`[FAIL-FAST] ${gameType} does not register a notepad screen`);
  }
  return <Screen />;
};
