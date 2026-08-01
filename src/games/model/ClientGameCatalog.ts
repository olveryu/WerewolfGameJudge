/** Game-neutral client module catalog contract and exhaustive lookup helpers. */

import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type React from 'react';

import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import type { GameNavigationContribution } from '@/features/navigation/model/GameNavigationContribution';
import type { GameAudioPreviewContribution } from '@/features/product/model/GameAudioPreview';
import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';
import type { RoomAccountCapability } from '@/features/room/model/RoomAccountCapability';
import {
  type RegisteredRoomUiModule,
  registerRoomUiModule,
  type RoomUiModule,
} from '@/features/room/model/RoomUiModule';

export interface ClientGameModule<
  TGameType extends string = GameType,
> extends RoomUiModule<TGameType> {
  readonly home: GameHomeContribution;
  readonly navigation: GameNavigationContribution<TGameType>;
  readonly roomAccount: RoomAccountCapability<TGameType>;
  readonly productUi: GameProductUiContribution;
  readonly audioPreview: GameAudioPreviewContribution | null;
  readonly accountStatsSection: React.ComponentType<{ readonly userId: string }>;
  readonly appOverlay: React.ComponentType | null;
}

type ClientGameCatalogEntry<TGameType extends GameType> = Omit<
  ClientGameModule<TGameType>,
  'gameType' | 'roomScreen'
> &
  RegisteredRoomUiModule<TGameType>;

export type ClientGameCatalog = {
  readonly [TGameType in GameType]: ClientGameCatalogEntry<TGameType>;
};

export type RegisteredClientGameModule = ClientGameCatalog[GameType];

export function registerClientGameModule<TGameType extends GameType>(
  module: ClientGameModule<TGameType>,
): ClientGameCatalogEntry<TGameType> {
  return { ...module, ...registerRoomUiModule(module) };
}

export function getClientGameModule<TGameType extends GameType>(
  catalog: ClientGameCatalog,
  gameType: TGameType,
): ClientGameCatalog[TGameType] {
  return catalog[gameType];
}

export function getClientGameModules(
  catalog: ClientGameCatalog,
): readonly RegisteredClientGameModule[] {
  return GAME_TYPES.map((gameType) => catalog[gameType]);
}
