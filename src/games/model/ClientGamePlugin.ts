/** Open authoring contract for one client game plugin before production registration. */

import type { GameNavigationDefinition } from '@/features/navigation/model/GameNavigationContribution';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';
import type { RoomLinkFactory } from '@/platform/realtime/RoomLinkFactory';
import type { AudioService } from '@/services/infra/AudioService';

export interface ClientGameModuleDependencies {
  readonly sessionFactory: RoomLinkFactory;
  readonly audioService: AudioService;
}

export interface ClientGamePluginDefinition<TGameType extends string> {
  readonly gameType: TGameType;
  readonly navigation: GameNavigationDefinition<TGameType>;
  createModule(dependencies: ClientGameModuleDependencies): ClientGameModule<TGameType>;
}
