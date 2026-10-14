/**
 * 阿瓦隆结构化角色介绍 → 共享 DescriptionField[] 的唯一转换。
 *
 * 角色卡（AvalonRoleCardAdapter）与图鉴/说明页共用这一份字段表与转换，
 * 不许在展示层再抄一份标签/图标/顺序。字段顺序与狼人杀一致：
 * skill → passive → trigger → restriction → special → winCondition。
 */
import type Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';

import type { DescriptionField } from '@/features/room/model/RevealRoleData';

import type { AvalonRoleDescription } from './avalonRoleMeta';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const FIELD_LABELS: Readonly<Record<keyof AvalonRoleDescription, string>> = {
  skill: '主动技能',
  passive: '被动特性',
  trigger: '触发效果',
  restriction: '限制条件',
  special: '特殊规则',
  winCondition: '胜利条件',
} as const;

const FIELD_ICONS: Readonly<Record<keyof AvalonRoleDescription, IconName>> = {
  skill: 'flash-outline',
  passive: 'shield-outline',
  trigger: 'locate-outline',
  restriction: 'close-circle-outline',
  special: 'star-outline',
  winCondition: 'trophy-outline',
} as const;

const FIELD_TONES: Readonly<Record<keyof AvalonRoleDescription, DescriptionField['tone']>> = {
  skill: 'default',
  passive: 'default',
  trigger: 'default',
  restriction: 'warning',
  special: 'default',
  winCondition: 'success',
} as const;

const FIELD_ORDER: ReadonlyArray<keyof AvalonRoleDescription> = [
  'skill',
  'passive',
  'trigger',
  'restriction',
  'special',
  'winCondition',
] as const;

/** 把结构化介绍转成共享渲染字段；空字段跳过不渲染。 */
export function toAvalonRoleDescriptionFields(
  description: AvalonRoleDescription,
): readonly DescriptionField[] {
  const fields: DescriptionField[] = [];
  for (const key of FIELD_ORDER) {
    const content = description[key];
    if (content !== undefined && content.length > 0) {
      fields.push({
        label: FIELD_LABELS[key],
        content,
        icon: FIELD_ICONS[key],
        tone: FIELD_TONES[key],
      });
    }
  }
  return fields;
}
