/** Werewolf contribution to the Home surface. */
import werewolfArt from '@/assets/game-art/werewolf.webp';
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import IconMoonOutline from '~icons/ion/moon-outline';

export const werewolfHome = {
  mode: {
    displayName: '狼人杀',
    subtitle: '经典身份推理',
    Icon: IconMoonOutline,
    tier: 'main',
    gradient: [colors.primaryLight, colors.primary],
    artUrl: werewolfArt,
  },
  // The spotlight pulls in role specs and portraits: its own chunk, loaded after Home renders.
  loadSpotlight: async () =>
    (await import('./components/WerewolfHomeSpotlight')).WerewolfHomeSpotlight,
  announcementTabs: [
    {
      id: 'boards',
      label: '板子',
      loadContent: async () =>
        (await import('./components/WerewolfBoardAnnouncementTab')).WerewolfBoardAnnouncementTab,
    },
  ],
} satisfies GameHomeContribution;
