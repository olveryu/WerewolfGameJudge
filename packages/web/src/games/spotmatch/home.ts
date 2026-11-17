/** 一眼成对 contribution to the Home surface. */
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconGameControllerOutline from '~icons/ion/game-controller-outline';

export const spotmatchHome = {
  mode: {
    displayName: '一眼成对',
    subtitle: '同时找相同，抢先出完手牌',
    Icon: IconGameControllerOutline,
    tier: 'mini',
    gradient: [lighten(colors.primary, 0.45), colors.primary],
  },
} satisfies GameHomeContribution;
