/** Exhaustive client game-module catalog. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';

import type { GameUiModule } from '@/features/room/model/GameUiModule';

import { werewolfUiModule } from './werewolf/module';

type ClientGameCatalog = {
  readonly [TGameType in GameType]: GameUiModule<TGameType>;
};

const CLIENT_GAME_CATALOG = {
  werewolf: werewolfUiModule,
} satisfies ClientGameCatalog;

export function getClientGameModule<TGameType extends GameType>(
  gameType: TGameType,
): ClientGameCatalog[TGameType] {
  return CLIENT_GAME_CATALOG[gameType];
}
