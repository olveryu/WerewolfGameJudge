/**
 * 阿瓦隆 → 通用 RevealRoleData 适配器。
 *
 * 将结构化 AvalonRoleDescription 转换为 DescriptionField[]，
 * 字段顺序与狼人杀一致：skill → passive → trigger → restriction → special → winCondition。
 */
import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';

import type { DescriptionField, RevealRoleData } from '@/features/room/model/RevealRoleData';

import { type AvalonRoleDescription, getAvalonRoleMeta } from '../model/avalonRoleMeta';

const FIELD_LABELS: Readonly<Record<keyof AvalonRoleDescription, string>> = {
  skill: '主动技能',
  passive: '被动特性',
  trigger: '触发效果',
  restriction: '限制条件',
  special: '特殊规则',
  winCondition: '胜利条件',
} as const;

const FIELD_ICONS: Readonly<Record<keyof AvalonRoleDescription, string>> = {
  skill: 'flash-outline',
  passive: 'shield-outline',
  trigger: 'locate-outline',
  restriction: 'close-circle-outline',
  special: 'star-outline',
  winCondition: 'trophy-outline',
} as const;

const FIELD_ORDER: ReadonlyArray<keyof AvalonRoleDescription> = [
  'skill',
  'passive',
  'trigger',
  'restriction',
  'special',
  'winCondition',
] as const;

function toDescriptionFields(desc: AvalonRoleDescription): readonly DescriptionField[] {
  const fields: DescriptionField[] = [];
  for (const key of FIELD_ORDER) {
    const content = desc[key];
    if (content !== undefined && content.length > 0) {
      fields.push({
        label: FIELD_LABELS[key],
        content,
        icon: FIELD_ICONS[key],
      });
    }
  }
  return fields;
}

/** 将阿瓦隆角色转换为通用揭示数据。 */
export function toRevealRoleData(roleId: AvalonRoleId): RevealRoleData {
  const meta = getAvalonRoleMeta(roleId);
  return {
    id: roleId,
    name: meta.displayName,
    // 坏人 → wolf（红），好人 → god（蓝）
    alignment: meta.isEvil ? 'wolf' : 'god',
    image: undefined, // 暂无立绘，显示阵营色占位
    description: toDescriptionFields(meta.description),
    factionName: meta.factionName,
  };
}
