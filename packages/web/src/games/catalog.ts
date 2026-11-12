/**
 * Exhaustive client game catalog: the only place that imports concrete games. Each entry grows as
 * the game's web screens land (home now; room, config and guide in later phases).
 */
import { GAME_REGISTRY } from '@game-judge/game-engine/games/registry';
import { GAME_TYPES, type GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { ComponentType } from 'react';

import { createAvalonAudioPreview } from '@/games/avalon/audio/audioPreview';
import { avalonHome } from '@/games/avalon/home';
import { demoHome } from '@/games/demo/home';
import { drawGuessHome } from '@/games/drawguess/home';
import { fibHome } from '@/games/fibking/home';
import type { GameAudioPreview, GameAudioPreviewFactory } from '@/games/model/GameAudioPreview';
import type { GameHomeContribution, GameModePresentation } from '@/games/model/GameHome';
import { pictionaryHome } from '@/games/pictionary/home';
import { storyRelayHome } from '@/games/storyrelay/home';
import { undercoverHome } from '@/games/undercover/home';
import { createWerewolfAudioPreview } from '@/games/werewolf/audio/audioPreview';
import { WerewolfAccountStatsSection } from '@/games/werewolf/components/WerewolfAccountStatsSection';
import { werewolfHome } from '@/games/werewolf/home';
import type { AudioService } from '@/services/infra/AudioService';

interface ClientGameModule {
  readonly home: GameHomeContribution;
  /** Narrated games create a music-settings preview only when that page requests it. */
  readonly loadAudioPreview?: () => Promise<GameAudioPreviewFactory>;
  /** Game-owned statistics, mounted only on the account settings page. */
  readonly AccountStats?: ComponentType<GameAccountStatsProps>;
}

/** Props of a game-owned account statistics section. */
interface GameAccountStatsProps {
  readonly userId: string;
}

const CLIENT_GAMES: { readonly [TGameType in GameType]: ClientGameModule } = {
  werewolf: {
    home: werewolfHome,
    loadAudioPreview: async () => createWerewolfAudioPreview,
    AccountStats: WerewolfAccountStatsSection,
  },
  fibking: { home: fibHome },
  pictionary: { home: pictionaryHome },
  undercover: { home: undercoverHome },
  drawguess: { home: drawGuessHome },
  storyrelay: { home: storyRelayHome },
  avalon: {
    home: avalonHome,
    loadAudioPreview: async () => createAvalonAudioPreview,
  },
  demo: { home: demoHome },
};

export interface ClientGameModeOption extends GameModePresentation {
  readonly gameType: GameType;
}

/** Resolve a game's localized name, including non-production directory entries. */
export function gameDisplayName(gameType: GameType): string {
  return CLIENT_GAMES[gameType].home.mode.displayName;
}

/**
 * Mode options for the Home picker, in catalog order. Games the registry marks non-production
 * stay joinable by code but are not offered on Home.
 */
export const GAME_MODE_OPTIONS: readonly ClientGameModeOption[] = GAME_TYPES.filter(
  (gameType) => GAME_REGISTRY[gameType].isProduction,
).map((gameType) => ({ gameType, ...CLIENT_GAMES[gameType].home.mode }));

export interface ClientGameHomeSpotlight {
  readonly gameType: GameType;
  readonly Spotlight: ComponentType;
}

/** Game-owned Home spotlight cards, available at start-up. */
export const GAME_HOME_SPOTLIGHTS: readonly ClientGameHomeSpotlight[] = GAME_TYPES.flatMap(
  (gameType) => {
    const { Spotlight } = CLIENT_GAMES[gameType].home;
    if (!GAME_REGISTRY[gameType].isProduction || Spotlight === undefined) return [];
    return [{ gameType, Spotlight }];
  },
);

export interface ClientGameAnnouncementTab {
  /** `${gameType}:${tabId}`, unique across the catalog. */
  readonly key: string;
  readonly label: string;
  readonly Content: ComponentType;
}

/** Game-owned announcement modal tabs of production games, in catalog order. */
export const GAME_ANNOUNCEMENT_TABS: readonly ClientGameAnnouncementTab[] = GAME_TYPES.flatMap(
  (gameType) => {
    if (!GAME_REGISTRY[gameType].isProduction) return [];
    const tabs = CLIENT_GAMES[gameType].home.announcementTabs ?? [];
    const tabIds = new Set(tabs.map((tab) => tab.id));
    if (tabIds.size !== tabs.length) {
      throw new Error(`[FAIL-FAST] Duplicate announcement tab id in ${gameType}`);
    }
    return tabs.map((tab) => ({
      key: `${gameType}:${tab.id}`,
      label: tab.label,
      Content: tab.Content,
    }));
  },
);

export interface ClientGameAccountStatsSection {
  readonly gameType: GameType;
  readonly Section: ComponentType<GameAccountStatsProps>;
}

/** Game-owned account statistics sections, in catalog order. */
export const GAME_ACCOUNT_STATS_SECTIONS: readonly ClientGameAccountStatsSection[] =
  GAME_TYPES.flatMap((gameType) => {
    const { AccountStats } = CLIENT_GAMES[gameType];
    if (AccountStats === undefined) return [];
    return [{ gameType, Section: AccountStats }];
  });

export interface ClientGameAudioPreview extends GameAudioPreview {
  readonly gameType: GameType;
}

/** Loads every game-owned audio preview, in catalog order, bound to `audioService`. */
export async function loadClientGameAudioPreviews(
  audioService: AudioService,
): Promise<readonly ClientGameAudioPreview[]> {
  const previews = await Promise.all(
    GAME_TYPES.map(async (gameType): Promise<ClientGameAudioPreview | null> => {
      const { loadAudioPreview } = CLIENT_GAMES[gameType];
      if (loadAudioPreview === undefined) return null;
      const createPreview = await loadAudioPreview();
      return { gameType, ...createPreview(audioService) };
    }),
  );
  return previews.filter((preview) => preview !== null);
}
