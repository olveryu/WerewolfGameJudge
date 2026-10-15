/**
 * Demo在首页的入口卡片。
 */
// TODO(gameplay): 展示名、副标题与图标是生成时的占位值，设计定稿后改。
import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';

export const demoHomeContribution = {
  mode: {
    displayName: 'Demo',
    subtitle: '模板参照游戏',
    iconName: 'game-controller-outline',
    tier: 'mini',
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
