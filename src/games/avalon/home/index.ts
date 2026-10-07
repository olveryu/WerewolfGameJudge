/**
 * 阿瓦隆在首页的入口卡片（大卡片 tier，与狼人杀并列）。
 */
import type { GameHomeContribution } from '@/features/home/model/GameHomeContribution';

export const avalonHomeContribution = {
  mode: {
    displayName: '阿瓦隆',
    subtitle: '身份推理 · 组队做任务 · 刺杀梅林',
    iconName: 'shield-outline',
    tier: 'main',
  },
  spotlight: null,
  announcementTabs: [],
} satisfies GameHomeContribution;
