/** FibKing contribution to the product Home surface. */

import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import { colors } from '@/theme';
import { lighten } from '@/theme/colorUtils';

export const fibHomeContribution = {
  mode: {
    displayName: '瞎掰王',
    subtitle: '看词描述，真假难辨',
    iconName: 'bulb-outline',
    tier: 'mini',
    gradient: [lighten(colors.warning, 0.55), colors.warning],
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
