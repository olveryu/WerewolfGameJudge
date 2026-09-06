/** Pictionary contribution to the product Home surface. */

import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';

export const pictionaryHomeContribution = {
  mode: {
    displayName: '你画我猜接龙',
    subtitle: '画与猜轮流传递，结局一起揭晓',
    iconName: 'brush-outline',
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
