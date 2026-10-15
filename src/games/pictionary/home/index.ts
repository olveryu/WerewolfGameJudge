/** Pictionary contribution to the product Home surface. */

import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import { colors } from '@/theme';
import { lighten } from '@/theme/colorUtils';

import pictionaryArt from '../../../../assets/game-art/pictionary.jpg';

export const pictionaryHomeContribution = {
  mode: {
    displayName: '你画我猜接龙',
    subtitle: '画与猜轮流传递，结局一起揭晓',
    iconName: 'brush-outline',
    tier: 'mini',
    gradient: [lighten(colors.god, 0.5), colors.god],
    art: pictionaryArt,
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
