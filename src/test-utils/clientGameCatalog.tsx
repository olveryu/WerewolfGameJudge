/** Typed client game catalog fixture for React tests. */

import type React from 'react';

import type { RevealEffectPreviewProps } from '@/features/product/model/GameProductUi';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { ClientGameCatalog } from '@/games/model/ClientGameCatalog';

const EmptyRoomScreen: React.FC<GameRoomScreenProps> = () => null;
const EmptyAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;
const EmptyScreen: React.FC = () => null;
const EmptyRevealEffectPreview: React.FC<RevealEffectPreviewProps> = () => null;

export function createTestClientGameCatalog(): ClientGameCatalog {
  return {
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
      navigation: {
        configScreen: EmptyScreen,
        guideScreen: EmptyScreen,
        notepadScreen: EmptyScreen,
      },
      roomScreen: EmptyRoomScreen,
      roomAccount: {
        gameType: 'werewolf',
        getSnapshot: () => ({
          gameType: 'werewolf',
          phase: 'idle',
          isSeated: false,
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
      },
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
  };
}
