/** FibKing contribution to the product Home surface. */

import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import { colors } from '@/theme';
import { lighten } from '@/theme/colorUtils';

import fibkingArt from '../../../../assets/game-art/fibking.jpg';

export const fibHomeContribution = {
  mode: {
    displayName: '瞎掰王',
    subtitle: '看词描述，真假难辨',
    iconName: 'bulb-outline',
    tier: 'mini',
    gradient: [lighten(colors.warning, 0.55), colors.warning],
    art: fibkingArt,
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
