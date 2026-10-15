/**
 * 阿瓦隆在首页的入口卡片（大卡片 tier，与狼人杀并列）。
 */
import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import { colors } from '@/theme';
import { lighten } from '@/theme/colorUtils';

import avalonArt from '../../../../assets/game-art/avalon.jpg';

export const avalonHomeContribution = {
  mode: {
    displayName: '阿瓦隆',
    subtitle: '身份推理 · 组队做任务 · 刺杀梅林',
    iconName: 'shield-outline',
    tier: 'main',
    gradient: [lighten(colors.info, 0.55), colors.info],
    art: avalonArt,
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
