/** Typed client game catalog fixture for React tests. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type React from 'react';

import { bindGameNavigation } from '@/features/navigation/model/GameNavigationContribution';
import type { RevealEffectPreviewProps } from '@/features/product/model/GameProductUi';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { CLIENT_GAME_PLUGIN_CATALOG } from '@/games/catalog';
import type { ClientGameCatalog } from '@/games/model/ClientGameCatalog';

const EmptyRoomScreen: React.FC<GameRoomScreenProps> = () => null;
const EmptyAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;
const EmptyScreen: React.FC = () => null;
const EmptyRevealEffectPreview: React.FC<RevealEffectPreviewProps> = () => null;

function createIdleRoomAccount<TGameType extends GameType>(gameType: TGameType) {
  return {
    gameType,
    getSnapshot: () => ({
      gameType,
      phase: 'idle' as const,
      isSeated: false as const,
      canSwitchAccount: true,
      canSyncProfile: false,
    }),
    subscribe: () => () => {},
    updateProfile: async () => {
      throw new Error('[FAIL-FAST] Test room account is idle');
    },
    leaveSeat: async () => {
      throw new Error('[FAIL-FAST] Test room account is idle');
    },
  };
}

export function createTestClientGameCatalog(): ClientGameCatalog {
  return {
    storyrelay: {
      gameType: 'storyrelay',
      home: {
        mode: {
          displayName: '故事接龙',
          subtitle: '一人写一段，一起揭晓故事',
          iconName: 'book-outline',
        },
        spotlight: null,
        announcementTabs: [],
      },
      navigation: bindGameNavigation(CLIENT_GAME_PLUGIN_CATALOG.storyrelay.navigation, {
        config: EmptyScreen,
        guide: EmptyScreen,
      }),
      roomScreen: EmptyRoomScreen,
      roomAccount: createIdleRoomAccount('storyrelay'),
      productUi: { getAvatarDisplayName: () => null, getRevealEffectPresentation: () => null },
      audioPreview: null,
      accountStatsSection: EmptyAccountStatsSection,
      appOverlay: null,
    },
    undercover: {
      gameType: 'undercover',
      home: {
        mode: {
          displayName: '谁是卧底',
          subtitle: '线下指人投票，房主揭晓',
          iconName: 'finger-print-outline',
        },
        spotlight: null,
        announcementTabs: [],
      },
      navigation: bindGameNavigation(CLIENT_GAME_PLUGIN_CATALOG.undercover.navigation, {
        config: EmptyScreen,
        guide: EmptyScreen,
      }),
      roomScreen: EmptyRoomScreen,
      roomAccount: createIdleRoomAccount('undercover'),
      productUi: { getAvatarDisplayName: () => null, getRevealEffectPresentation: () => null },
      audioPreview: null,
      accountStatsSection: EmptyAccountStatsSection,
      appOverlay: null,
    },
    werewolf: {
      gameType: 'werewolf',
      home: {
        mode: {
          displayName: '狼人杀',
          subtitle: '经典身份推理',
          iconName: 'moon-outline',
        },
        spotlight: null,
        announcementTabs: [],
      },
      navigation: bindGameNavigation(CLIENT_GAME_PLUGIN_CATALOG.werewolf.navigation, {
        config: EmptyScreen,
        guide: EmptyScreen,
        notepad: EmptyScreen,
      }),
      roomScreen: EmptyRoomScreen,
      roomAccount: createIdleRoomAccount('werewolf'),
      productUi: {
        getAvatarDisplayName: (avatarId) => avatarId,
        getRevealEffectPresentation: (effectId) =>
          effectId === 'roulette'
            ? {
                id: 'roulette',
                label: effectId,
                icon: 'help-outline',
                shortDescription: effectId,
                Preview: EmptyRevealEffectPreview,
              }
            : null,
      },
      audioPreview: null,
      accountStatsSection: EmptyAccountStatsSection,
      appOverlay: null,
    },
    fibking: {
      gameType: 'fibking',
      home: {
        mode: {
          displayName: '瞎掰王',
          subtitle: '看词描述，真假难辨',
          iconName: 'bulb-outline',
        },
        spotlight: null,
        announcementTabs: [],
      },
      navigation: bindGameNavigation(CLIENT_GAME_PLUGIN_CATALOG.fibking.navigation, {
        config: EmptyScreen,
        guide: EmptyScreen,
      }),
      roomScreen: EmptyRoomScreen,
      roomAccount: createIdleRoomAccount('fibking'),
      productUi: {
        getAvatarDisplayName: () => null,
        getRevealEffectPresentation: () => null,
      },
      audioPreview: null,
      accountStatsSection: EmptyAccountStatsSection,
      appOverlay: null,
    },
    pictionary: {
      gameType: 'pictionary',
      home: {
        mode: {
          displayName: '你画我猜接龙',
          subtitle: '画与猜轮流传递',
          iconName: 'brush-outline',
        },
        spotlight: null,
        announcementTabs: [],
      },
      navigation: bindGameNavigation(CLIENT_GAME_PLUGIN_CATALOG.pictionary.navigation, {
        config: EmptyScreen,
        guide: EmptyScreen,
      }),
      roomScreen: EmptyRoomScreen,
      roomAccount: createIdleRoomAccount('pictionary'),
      productUi: {
        getAvatarDisplayName: () => null,
        getRevealEffectPresentation: () => null,
      },
      audioPreview: null,
      accountStatsSection: EmptyAccountStatsSection,
      appOverlay: null,
    },
  };
}
