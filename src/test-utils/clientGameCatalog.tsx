/** Typed client game catalog fixture for React tests. */

import type React from 'react';

import type { RevealEffectPreviewProps } from '@/features/product/model/GameProductUi';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import type { ClientGameCatalog } from '@/games/catalog';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';

const EmptyRoomScreen: React.FC<GameRoomScreenProps> = () => null;
const EmptyAccountStatsSection: React.FC<{ readonly userId: string }> = () => null;
const EmptyScreen: React.FC = () => null;
const EmptyRevealEffectPreview: React.FC<RevealEffectPreviewProps> = () => null;

export function createTestClientGameCatalog(client: WerewolfGameClient): ClientGameCatalog {
  return {
    werewolf: {
      gameType: 'werewolf',
      client,
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
      accountStatsSection: EmptyAccountStatsSection,
      appOverlay: null,
      screens: {
        boardPicker: EmptyScreen,
        config: EmptyScreen,
        encyclopedia: EmptyScreen,
        rules: EmptyScreen,
        notepad: EmptyScreen,
      },
    },
  };
}
