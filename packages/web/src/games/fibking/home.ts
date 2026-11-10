/** FibKing contribution to the Home surface. */
import fibkingArt from '@/assets/game-art/fibking.webp';
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconBulbOutline from '~icons/ion/bulb-outline';

export const fibHome = {
  mode: {
    displayName: '瞎掰王',
    subtitle: '看词描述，真假难辨',
    Icon: IconBulbOutline,
    tier: 'mini',
    gradient: [lighten(colors.warning, 0.55), colors.warning],
    artUrl: fibkingArt,
  },
} satisfies GameHomeContribution;
