/** Exhaustive client game-module catalog created by the application composition root. */

import { GAME_TYPES, type GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type React from 'react';

import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';
import type { RoomAccountCapability } from '@/features/room/model/RoomAccountCapability';
import type { RoomUiModule } from '@/features/room/model/RoomUiModule';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { createWerewolfUiModule, type WerewolfUiModuleExtension } from '@/games/werewolf/module';
import type { AudioService } from '@/services/infra/AudioService';

export interface ClientGameModule<
  TGameType extends GameType = GameType,
> extends RoomUiModule<TGameType> {
  readonly roomAccount: RoomAccountCapability<TGameType>;
  readonly productUi: GameProductUiContribution;
  readonly accountStatsSection: React.ComponentType<{ readonly userId: string }>;
  readonly appOverlay: React.ComponentType | null;
}

interface ClientGameModuleByType {
  readonly werewolf: ClientGameModule<'werewolf'> & WerewolfUiModuleExtension;
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

export function getClientGameModules(catalog: ClientGameCatalog): readonly ClientGameModule[] {
  return GAME_TYPES.map((gameType) => catalog[gameType]);
}
