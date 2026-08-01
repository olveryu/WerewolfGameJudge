/** Aggregate game-owned Home contributions at the client composition boundary. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type React from 'react';

import type {
  GameAnnouncementTabContentProps,
  GameModeIconName,
} from '@/features/home/model/GameHomeContribution';

import type { RegisteredClientGameModule } from './model/ClientGameCatalog';

export interface ClientGameModeOption {
  readonly gameType: GameType;
  readonly displayName: string;
  readonly subtitle: string;
  readonly iconName: GameModeIconName;
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
