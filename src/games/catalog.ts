/** Exhaustive client game-plugin catalog and application module factory. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import type { GameNavigationDefinition } from '@/features/navigation/model/GameNavigationContribution';
import type { GameSessionFactory } from '@/features/room/session/GameSessionFactory';
import { createFibUiModule } from '@/games/fibking/module';
import { fibGameNavigation } from '@/games/fibking/navigation/fibGameNavigation';
import type { ClientGameCatalog, ClientGameModule } from '@/games/model/ClientGameCatalog';
import { createWerewolfUiModule } from '@/games/werewolf/module';
import { werewolfGameNavigation } from '@/games/werewolf/navigation/werewolfGameNavigation';
import type { AudioService } from '@/services/infra/AudioService';

export interface CreateClientGameCatalogDeps {
  readonly sessionFactory: GameSessionFactory;
  readonly audioService: AudioService;
}

interface ClientGamePluginDefinition<TGameType extends GameType> {
  readonly gameType: TGameType;
  readonly navigation: GameNavigationDefinition<TGameType>;
  createModule(dependencies: CreateClientGameCatalogDeps): ClientGameModule<TGameType>;
}

type ClientGamePluginCatalogShape = {
  readonly [TGameType in GameType]: ClientGamePluginDefinition<TGameType>;
};

/** The only client composition point that imports concrete game registrations. */
export const CLIENT_GAME_PLUGIN_CATALOG = {
  werewolf: {
    gameType: 'werewolf',
    navigation: werewolfGameNavigation,
    createModule: ({ sessionFactory, audioService }) =>
      createWerewolfUiModule({ sessionFactory, audioService }),
  },
  fibking: {
    gameType: 'fibking',
    navigation: fibGameNavigation,
    createModule: ({ sessionFactory }) => createFibUiModule({ sessionFactory }),
  },
} satisfies ClientGamePluginCatalogShape;

export function createClientGameCatalog(
  dependencies: CreateClientGameCatalogDeps,
): ClientGameCatalog {
  return {
    werewolf: CLIENT_GAME_PLUGIN_CATALOG.werewolf.createModule(dependencies),
    fibking: CLIENT_GAME_PLUGIN_CATALOG.fibking.createModule(dependencies),
  };
}
