/** Open authoring contract for one client game plugin before production registration. */

import type { GameNavigationDefinition } from '@/features/navigation/model/GameNavigationContribution';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import type { ClientGameModule } from '@/games/model/ClientGameCatalog';
import type { AudioService } from '@/services/infra/AudioService';

export interface ClientGameModuleDependencies {
  readonly sessionFactory: GameSessionFactory;
  readonly audioService: AudioService;
}

export interface ClientGamePluginDefinition<TGameType extends string> {
  readonly gameType: TGameType;
  readonly navigation: GameNavigationDefinition<TGameType>;
  createModule(dependencies: ClientGameModuleDependencies): ClientGameModule<TGameType>;
}
