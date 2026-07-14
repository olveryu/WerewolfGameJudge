/** Exhaustive client game-module catalog created by the application composition root. */

import { GAME_TYPES, type GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';

import type { GameUiModule } from '@/features/room/model/GameUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { createWerewolfUiModule, type WerewolfUiModule } from '@/games/werewolf/module';
import type { AudioService } from '@/services/infra/AudioService';

interface ClientGameModuleByType {
  readonly werewolf: WerewolfUiModule;
}

export type ClientGameCatalog = {
  readonly [TGameType in GameType]: ClientGameModuleByType[TGameType];
};

interface CreateClientGameCatalogDeps {
  readonly sessionFactory: GameSessionFactory;
  readonly audioService: AudioService;
}

export function createClientGameCatalog({
  sessionFactory,
  audioService,
}: CreateClientGameCatalogDeps): ClientGameCatalog {
  return {
    werewolf: createWerewolfUiModule({ sessionFactory, audioService }),
  };
}

export function getClientGameModule<TGameType extends GameType>(
  catalog: ClientGameCatalog,
  gameType: TGameType,
): ClientGameCatalog[TGameType] {
  return catalog[gameType];
}

export function getClientGameModules(catalog: ClientGameCatalog): readonly GameUiModule[] {
  return GAME_TYPES.map((gameType) => catalog[gameType]);
}
