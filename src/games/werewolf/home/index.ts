/** Werewolf contribution to the product Home surface. */

import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';

import { WerewolfBoardAnnouncementTab } from './WerewolfBoardAnnouncementTab';
import { WerewolfHomeSpotlight } from './WerewolfHomeSpotlight';

export const werewolfHomeContribution = {
  mode: {
    displayName: '狼人杀',
    subtitle: '经典身份推理',
    iconName: 'moon-outline',
  },
  spotlight: WerewolfHomeSpotlight,
  announcementTabs: [
    {
      id: 'boards',
      label: '板子',
      Content: WerewolfBoardAnnouncementTab,
    },
  ],
} satisfies GameHomeContribution;
