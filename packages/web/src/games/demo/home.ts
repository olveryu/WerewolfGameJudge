/** Demo contribution to the Home surface. */
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconGameControllerOutline from '~icons/ion/game-controller-outline';

export const demoHome = {
  mode: {
    displayName: 'Demo',
    subtitle: '模板参照游戏',
    Icon: IconGameControllerOutline,
    tier: 'mini',
    gradient: [lighten(colors.primary, 0.45), colors.primary],
  },
} satisfies GameHomeContribution;
