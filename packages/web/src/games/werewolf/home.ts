/** Werewolf contribution to the Home surface. */
import werewolfArt from '@/assets/game-art/werewolf.webp';
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import IconMoonOutline from '~icons/ion/moon-outline';

import { WerewolfBoardAnnouncementTab } from './components/WerewolfBoardAnnouncementTab';
import { WerewolfHomeSpotlight } from './components/WerewolfHomeSpotlight';

export const werewolfHome = {
  mode: {
    displayName: '狼人杀',
    subtitle: '经典身份推理',
    Icon: IconMoonOutline,
    tier: 'main',
    gradient: [colors.primaryLight, colors.primary],
    artUrl: werewolfArt,
  },
  Spotlight: WerewolfHomeSpotlight,
  announcementTabs: [
    {
      id: 'boards',
      label: '板子',
      Content: WerewolfBoardAnnouncementTab,
    },
  ],
} satisfies GameHomeContribution;
