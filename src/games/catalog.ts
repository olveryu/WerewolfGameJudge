/** Exhaustive client game-module catalog created by the application composition root. */

import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { createFibUiModule } from '@/games/fibking/module';
import type { ClientGameCatalog } from '@/games/model/ClientGameCatalog';
import { createWerewolfUiModule } from '@/games/werewolf/module';
import type { AudioService } from '@/services/infra/AudioService';

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
    fibking: createFibUiModule({ sessionFactory }),
  };
}
