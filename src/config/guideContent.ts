/**
 * guideContent — 各页面新手引导内容定义
 *
 * 纯数据模块，不含组件/hooks/副作用。
 * 各页面 import 对应内容传入 PageGuideModal。
 */
import { PRESET_TEMPLATES } from '@werewolf/game-engine/models/Template';

import type { GuideItem } from '@/components/PageGuideModal';
import { AVATAR_IMAGES } from '@/utils/avatar';

// ============================================
// HomeScreen
// ============================================

export const HOME_GUIDE = {
  titleEmoji: '🏠',
  title: '欢迎来到狼人杀法官',
  items: [
    { emoji: '🎯', text: '加入房间 —— 输入朋友给的 4 位房间码' },
    { emoji: '⊕', text: '创建房间 —— 选模板，一键开新局' },
    { emoji: '📖', text: '角色图鉴 —— 右上角查看所有角色技能' },
    { emoji: '⚙️', text: '个人设置 —— 右上角换头像、昵称、主题' },
  ] satisfies GuideItem[],
} as const;

// ============================================
// ConfigScreen
// ============================================

export const CONFIG_GUIDE = {
  titleEmoji: '🎲',
  title: '配置你的游戏',
  items: [
    {
      emoji: '📋',
      text: `选择模板 —— ${PRESET_TEMPLATES.length} 个预设一键选，新手推荐"预女猎白"`,
    },
    { emoji: '🎛️', text: '自定义角色 —— 下方可自由增减任意角色' },
    { emoji: '👆', text: '长按角色 —— 可查看技能详情和变体' },
    { emoji: '👥', text: '底部按钮 —— 显示总人数，点击即创建房间' },
  ] satisfies GuideItem[],
};

// ============================================
// RoomScreen — 总览 (首次进入房间)
// ============================================

const ROOM_BASE_ITEMS: GuideItem[] = [
  { emoji: '💺', text: '点击空座位坐下，等所有人就位' },
  { emoji: '🃏', text: '分配角色后，点"查看身份"看你的角色' },
  { emoji: '🌙', text: '天黑后，按屏幕提示操作你的技能' },
  { emoji: '📝', text: '记事本可做笔记和标记猜测角色' },
];

const ROOM_MENU_ITEM_NON_HOST: GuideItem = {
  emoji: '⋯',
  text: '右上角菜单 —— 角色百科、分享房间、个人设置',
};

const ROOM_MENU_ITEM_HOST: GuideItem = {
  emoji: '⋯',
  text: '右上角菜单 —— 角色百科、分享房间、游戏设置等',
};

const ROOM_HOST_ITEM: GuideItem = {
  emoji: '👑',
  text: '你是房主 —— 底部有分配角色、开始天黑等控制按钮',
};

export function getRoomGuideItems(isHost: boolean): GuideItem[] {
  return [
    ...ROOM_BASE_ITEMS,
    isHost ? ROOM_MENU_ITEM_HOST : ROOM_MENU_ITEM_NON_HOST,
    ...(isHost ? [ROOM_HOST_ITEM] : []),
  ];
}

export const ROOM_GUIDE_TITLE = {
  titleEmoji: '🎮',
  title: '游戏房间',
} as const;

// ============================================
// RoomScreen — 查看身份阶段 (Assigned)
// ============================================

export const ROOM_ASSIGNED_GUIDE = {
  titleEmoji: '🃏',
  title: '该看身份啦',
  items: [
    { emoji: '👆', text: '点"查看身份"翻牌看你的角色' },
    { emoji: '🤫', text: '看完后不要声张，悄悄记住' },
    { emoji: '🔍', text: '不认识角色？点右上角 ⋯ → 角色百科查看' },
  ] satisfies GuideItem[],
} as const;

// ============================================
// RoomScreen — 游戏进行阶段 (Ongoing)
// ============================================

export const ROOM_ONGOING_GUIDE = {
  titleEmoji: '🌙',
  title: '天黑请闭眼',
  items: [
    { emoji: '📢', text: '轮到你时屏幕会亮起提示，按提示操作' },
    { emoji: '💺', text: '需要选人？点击座位选择目标' },
    { emoji: '✅', text: '操作完毕后点确认按钮提交' },
    { emoji: '⏭️', text: '没有技能可用？点"不用技能"跳过' },
  ] satisfies GuideItem[],
} as const;

// ============================================
// SettingsScreen
// ============================================

export const SETTINGS_GUIDE = {
  titleEmoji: '⚙️',
  title: '个人设置',
  items: [
    { emoji: '🖼️', text: `点头像换装 —— ${AVATAR_IMAGES.length} 个内置头像 + 自定义上传` },
    { emoji: '🪪', text: '设昵称让朋友在房间里认出你' },
    { emoji: '🎨', text: '8 种主题随你换，亮暗都有' },
    { emoji: '📧', text: '绑定邮箱可跨设备保留数据' },
  ] satisfies GuideItem[],
};

// ============================================
// EncyclopediaScreen
// ============================================

export const ENCYCLOPEDIA_GUIDE = {
  titleEmoji: '📖',
  title: '角色图鉴',
  items: [
    { emoji: '🏷️', text: '顶部切换阵营 —— 神职 / 狼人 / 村民 / 第三方' },
    { emoji: '👆', text: '点击任意角色查看完整技能描述' },
    { emoji: '💡', text: '不认识的角色？开局前来这里提前了解' },
  ] satisfies GuideItem[],
} as const;
