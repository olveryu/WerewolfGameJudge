/** Exhaustive client game-plugin catalog and application module factory. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';

import { createFibUiModule } from '@/games/fibking/module';
import { fibGameNavigation } from '@/games/fibking/navigation/fibGameNavigation';
import { type ClientGameCatalog, registerClientGameModule } from '@/games/model/ClientGameCatalog';
import type {
  ClientGameModuleDependencies,
  ClientGamePluginDefinition,
} from '@/games/model/ClientGamePlugin';
import { createWerewolfUiModule } from '@/games/werewolf/module';
import { werewolfGameNavigation } from '@/games/werewolf/navigation/werewolfGameNavigation';

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
  dependencies: ClientGameModuleDependencies,
): ClientGameCatalog {
  return {
    werewolf: registerClientGameModule(
      CLIENT_GAME_PLUGIN_CATALOG.werewolf.createModule(dependencies),
    ),
    fibking: registerClientGameModule(
      CLIENT_GAME_PLUGIN_CATALOG.fibking.createModule(dependencies),
    ),
  };
}
