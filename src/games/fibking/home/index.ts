/** FibKing contribution to the product Home surface. */

import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';

export const fibHomeContribution = {
  mode: {
    displayName: '瞎掰王',
    subtitle: '看词描述，真假难辨',
    iconName: 'bulb-outline',
    tier: 'mini',
    playerLabel: '4–20人',
    durationLabel: '约20分钟',
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
