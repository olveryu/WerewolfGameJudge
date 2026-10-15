/** Aggregate game-owned Home contributions at the client composition boundary. */

import { GAME_REGISTRY } from '@game-judge/game-engine/games/registry';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type React from 'react';
import type { ImageSourcePropType } from 'react-native';

import type {
  GameAnnouncementTabContentProps,
  GameHomeTier,
  GameModeIconName,
} from '@/features/home/model/GameHomeContribution';

import type { RegisteredClientGameModule } from './model/ClientGameCatalog';

export interface ClientGameModeOption {
  readonly gameType: GameType;
  readonly displayName: string;
  readonly subtitle: string;
  readonly iconName: GameModeIconName;
  readonly tier: GameHomeTier;
  readonly gradient: readonly [string, string];
  readonly art?: ImageSourcePropType;
}

export interface ClientGameHomeSpotlight {
  readonly gameType: GameType;
  readonly spotlight: React.ComponentType;
}

export interface ClientGameAnnouncementTab {
  readonly key: string;
  readonly label: string;
  readonly Content: React.ComponentType<GameAnnouncementTabContentProps>;
}

export interface ClientGameHome {
  readonly modeOptions: readonly ClientGameModeOption[];
  readonly guideOptions: readonly ClientGameModeOption[];
  readonly spotlights: readonly ClientGameHomeSpotlight[];
  readonly announcementTabs: readonly ClientGameAnnouncementTab[];
}

export function createClientGameHome(
  modules: readonly RegisteredClientGameModule[],
): ClientGameHome {
  if (modules.length === 0) {
    throw new Error('[FAIL-FAST] Client game catalog must provide at least one Home contribution');
  }

  const gameTypes = new Set<GameType>();
  const announcementKeys = new Set<string>();
  const modeOptions: ClientGameModeOption[] = [];
  const guideOptions: ClientGameModeOption[] = [];
  const spotlights: ClientGameHomeSpotlight[] = [];
  const announcementTabs: ClientGameAnnouncementTab[] = [];

  for (const module of modules) {
    if (gameTypes.has(module.gameType)) {
      throw new Error(`[FAIL-FAST] Duplicate Home contribution for ${module.gameType}`);
    }
    gameTypes.add(module.gameType);

    // The single production filter (registry `isProduction`, plan
    // §7.1 / D8): a game that is registered but not in production
    // contributes nothing to any player-facing Home list — no mode
    // option (lobby / create-room picker), no guide option, no
    // spotlight, no announcement tab. The module itself stays in the
    // catalog, so rooms remain joinable by code and the game stays
    // fully wired underneath.
    if (!GAME_REGISTRY[module.gameType].isProduction) continue;

    const modeOption = { gameType: module.gameType, ...module.home.mode };
    modeOptions.push(modeOption);
    if (module.navigation.guide.kind === 'screen') guideOptions.push(modeOption);
    if (module.home.spotlight !== null) {
      spotlights.push({ gameType: module.gameType, spotlight: module.home.spotlight });
    }

    for (const tab of module.home.announcementTabs) {
      const key = `${module.gameType}:${tab.id}`;
      if (announcementKeys.has(key)) {
        throw new Error(`[FAIL-FAST] Duplicate game announcement tab ${key}`);
      }
      announcementKeys.add(key);
      announcementTabs.push({ key, label: tab.label, Content: tab.Content });
    }
  }

  return { modeOptions, guideOptions, spotlights, announcementTabs };
}
