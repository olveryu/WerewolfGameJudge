/** Game-neutral client module catalog contract and exhaustive lookup helpers. */

import { GAME_TYPES, type GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type React from 'react';

import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import type { GameNavigationContribution } from '@/features/navigation/model/GameNavigationContribution';
import type { GameAudioPreviewContribution } from '@/features/product/model/GameAudioPreview';
import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';
import type { RoomAccountCapability } from '@/features/room/model/RoomAccountCapability';
import type { RoomUiModule } from '@/features/room/model/RoomUiModule';

export interface ClientGameModule<
  TGameType extends GameType = GameType,
> extends RoomUiModule<TGameType> {
  readonly home: GameHomeContribution;
  readonly navigation: GameNavigationContribution<TGameType>;
  readonly roomAccount: RoomAccountCapability<TGameType>;
  readonly productUi: GameProductUiContribution;
  readonly audioPreview: GameAudioPreviewContribution | null;
  readonly accountStatsSection: React.ComponentType<{ readonly userId: string }>;
  readonly appOverlay: React.ComponentType | null;
}

export type ClientGameCatalog = {
  readonly [TGameType in GameType]: ClientGameModule<TGameType>;
};

export function getClientGameModule<TGameType extends GameType>(
  catalog: ClientGameCatalog,
  gameType: TGameType,
): ClientGameCatalog[TGameType] {
  return catalog[gameType];
}

export function getClientGameModules(catalog: ClientGameCatalog): readonly ClientGameModule[] {
  return GAME_TYPES.map((gameType) => catalog[gameType]);
}
