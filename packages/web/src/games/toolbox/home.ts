/** 聚会工具 contribution to the Home surface. */
import toolboxArt from '@/assets/game-art/toolbox.webp';
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconDiceOutline from '~icons/ion/dice-outline';

export const toolboxHome = {
  mode: {
    displayName: '聚会工具',
    subtitle: '摇骰子、抽身份，聚会道具随手用',
    Icon: IconDiceOutline,
    tier: 'mini',
    gradient: [lighten(colors.handResourceInk, 0.5), colors.handResourceInk],
    artUrl: toolboxArt,
  },
} satisfies GameHomeContribution;
