/**
 * 阿瓦隆 → 通用 RevealRoleData 适配器。
 *
 * 结构化介绍到 DescriptionField[] 的转换只有一份，住在
 * model/avalonRoleDescriptionFields.ts，卡链与图鉴/说明页共用。
 */
import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';

import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

import { getRoleAvatar } from '../assets/roleAvatars';
import { toAvalonRoleDescriptionFields } from '../model/avalonRoleDescriptionFields';
import { getAvalonRoleMeta } from '../model/avalonRoleMeta';

/** 将阿瓦隆角色转换为通用揭示数据。 */
export function toRevealRoleData(roleId: AvalonRoleId): RevealRoleData {
  const meta = getAvalonRoleMeta(roleId);
  return {
    id: roleId,
    name: meta.displayName,
    // 坏人 → wolf（红），好人 → god（蓝）
    alignment: meta.isEvil ? 'wolf' : 'god',
    image: getRoleAvatar(roleId),
    description: toAvalonRoleDescriptionFields(meta.description),
    factionName: meta.factionName,
  };
}
