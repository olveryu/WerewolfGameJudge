/**
 * 阿瓦隆角色中文展示名与阵营文案；纯展示数据，不含逻辑。
 */

import { type AvalonRoleId, isAvalonEvilRole } from '@game-judge/game-engine/games/avalon/public';

/** D2 固定板子角色的中文名（设计稿"固定板子"区）。 */
const AVALON_ROLE_DISPLAY_NAMES: Readonly<Record<AvalonRoleId, string>> = {
  merlin: '梅林',
  percival: '派西维尔',
  loyalServant: '忠臣',
  morgana: '莫甘娜',
  assassin: '刺客',
  mordred: '莫德雷德',
  oberon: '奥伯伦',
  minion: '爪牙',
};

/** 角色中文名；未知角色直接抛错，不猜测。 */
export function getAvalonRoleDisplayName(role: AvalonRoleId): string {
  const name = AVALON_ROLE_DISPLAY_NAMES[role];
  if (name === undefined) throw new Error(`Unknown Avalon role: ${role}`);
  return name;
}

/** 阵营中文名：好人 / 坏人。 */
export function getAvalonFactionDisplayName(role: AvalonRoleId): string {
  return isAvalonEvilRole(role) ? '坏人' : '好人';
}

/** 湖仙查验结果的阵营中文名：好 / 坏。 */
export function getAvalonCheckedFactionDisplayName(faction: 'good' | 'evil'): string {
  return faction === 'good' ? '好' : '坏';
}
