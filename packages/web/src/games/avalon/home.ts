/** Avalon contribution to the Home surface (main tier, beside Werewolf). */
import avalonArt from '@/assets/game-art/avalon.webp';
import type { GameHomeContribution } from '@/games/model/GameHome';
import { colors } from '@/theme/colors';
import { lighten } from '@/theme/colorUtils';
import IconShieldOutline from '~icons/ion/shield-outline';

export const avalonHome = {
  mode: {
    displayName: '阿瓦隆',
    subtitle: '身份推理 · 组队做任务 · 刺杀梅林',
    Icon: IconShieldOutline,
    tier: 'main',
    gradient: [lighten(colors.info, 0.55), colors.info],
    artUrl: avalonArt,
  },
} satisfies GameHomeContribution;
