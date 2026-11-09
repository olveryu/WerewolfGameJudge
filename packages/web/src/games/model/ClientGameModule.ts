/** Game-neutral client module contract consumed by the room, config and guide routes. */
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import type { GameNavigationContribution } from '@/features/navigation/model/GameNavigationContribution';
import type { RoomAccountCapability } from '@/features/room/model/RoomAccountCapability';
import type { RegisteredRoomUiModule } from '@/features/room/model/RoomUiModule';
import type { RoomLinkFactory } from '@/platform/realtime/RoomLinkFactory';

export interface ClientGameModule<
  TGameType extends GameType = GameType,
> extends RegisteredRoomUiModule<TGameType> {
  readonly navigation: GameNavigationContribution<TGameType>;
  readonly roomAccount: RoomAccountCapability<TGameType>;
}

export interface ClientGameModuleDependencies {
  readonly roomLinks: RoomLinkFactory;
}

/** A game's lazily loaded client entry: one module factory per game chunk. */
export type ClientGameModuleFactory<TGameType extends GameType> = (
  dependencies: ClientGameModuleDependencies,
) => ClientGameModule<TGameType>;
