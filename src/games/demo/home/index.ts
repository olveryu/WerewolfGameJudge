/**
 * Demo在首页的入口卡片。
 */
// TODO(gameplay): 展示名、副标题、图标与主题渐变是生成时的占位值，设计定稿后改。
import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';
import { colors } from '@/theme';
import { lighten } from '@/theme/colorUtils';

export const demoHomeContribution = {
  mode: {
    displayName: 'Demo',
    subtitle: '模板参照游戏',
    iconName: 'game-controller-outline',
    tier: 'mini',
    gradient: [lighten(colors.primary, 0.45), colors.primary],
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
