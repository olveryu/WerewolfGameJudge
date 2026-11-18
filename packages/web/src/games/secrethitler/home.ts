/** 秘密希特勒 contribution to the Home surface. */
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconGameControllerOutline from '~icons/ion/game-controller-outline';

export const secrethitlerHome = {
  mode: {
    displayName: '秘密希特勒',
    subtitle: '隐藏阵营玩家选举政府并秘密施行政策',
    Icon: IconGameControllerOutline,
    tier: 'main',
    gradient: [lighten(colors.primary, 0.45), colors.primary],
  },
} satisfies GameHomeContribution;
