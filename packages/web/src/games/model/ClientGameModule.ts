/** Game-neutral client module contract consumed by the room, config and guide routes. */
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { ComponentType } from 'react';

import type { GameNavigationContribution } from '@/features/navigation/model/GameNavigationContribution';
import type { RoomAccountCapability } from '@/features/room/model/RoomAccountCapability';
import type { RegisteredRoomUiModule } from '@/features/room/model/RoomUiModule';
import type { RoomLinkFactory } from '@/platform/realtime/RoomLinkFactory';
import type { AudioService } from '@/services/infra/AudioService';

export interface ClientGameModule<
  TGameType extends GameType = GameType,
> extends RegisteredRoomUiModule<TGameType> {
  readonly navigation: GameNavigationContribution<TGameType>;
  readonly roomAccount: RoomAccountCapability<TGameType>;
  /** App-wide overlay bound to the module session, mounted by the app root once loaded. */
  readonly appOverlay: ComponentType | null;
}

export interface ClientGameModuleDependencies {
  readonly roomLinks: RoomLinkFactory;
  readonly audioService: AudioService;
}

/** A game's lazily loaded client entry: one module factory per game chunk. */
export type ClientGameModuleFactory<TGameType extends GameType> = (
  dependencies: ClientGameModuleDependencies,
) => ClientGameModule<TGameType>;
