/**
 * 狼人杀角色卡牌适配器：将狼人杀专属的 RoleId 转为通用的 RevealRoleData。
 *
 * 处理狼人杀特有逻辑：
 * - displayAs 伪装（翻牌时显示伪装身份）
 * - 预言家编号（双预言家共存时显示"1号预言家"）
 * - 阵营映射（Faction → RevealAlignment）
 * - 立绘资源加载
 */
import {
  Faction,
  getRoleDisplayAs,
  getRoleDisplayName,
  getRoleSpec,
  getRoleStructuredDescription,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';

import type {
  DescriptionField,
  RevealAlignment,
  RevealRoleData,
} from '@/features/room/model/RevealRoleData';
import { getRoleAvatar } from '@/games/werewolf/assets/roleAvatars';
import { getFactionName } from '@/games/werewolf/components/roleDisplayUtils';

/**
 * 阵营映射：按 faction 直接映射。
 * hiddenWolf 的 faction=Wolf，显示狼红色（玩家自己知道自己是狼，卡片就该是红色）。
 * 注：原版 getFactionColor 先查 team 会导致隐狼显示绿，那是原版 bug，本次修正。
 */
function getAlignment(roleId: RoleId): RevealAlignment {
  const spec = getRoleSpec(roleId);
  if (spec?.faction === Faction.Wolf) return 'wolf';
  if (spec?.faction === Faction.God) return 'god';
  if (spec?.faction === Faction.Special) return 'third';
  return 'villager';
}

export interface ToRevealRoleDataOptions {
  /**
   * 为 true 时显示真实身份（跳过 displayAs 伪装）。
   * 法官视角的技能预览用。缺省 false。
   */
  readonly showRealIdentity?: boolean;
  /**
   * 双预言家编号（1 或 2），角色名显示为"X号预言家"。
   * 仅预言家+镜预言家共存时使用。
   */
  readonly seerLabel?: number;
}

/**
 * 将狼人杀 RoleId 转为通用 RevealRoleData。
 */
export function toRevealRoleData(roleId: RoleId, opts?: ToRevealRoleDataOptions): RevealRoleData {
  const showRealIdentity = opts?.showRealIdentity ?? false;
  // displayAs 伪装：翻牌时玩家看到伪装身份，法官视角看真实身份
  const displayId = showRealIdentity ? roleId : (getRoleDisplayAs(roleId) ?? roleId);

  const name =
    opts?.seerLabel != null ? `${opts.seerLabel}号预言家` : getRoleDisplayName(displayId);

  const desc = getRoleStructuredDescription(displayId);
  // 6 字段完整保留（含胜利条件），带中文标签、图标、语义色调
  const fields: DescriptionField[] = [];
  if (desc?.skill)
    fields.push({ label: '主动技能', content: desc.skill, icon: 'flash-outline', tone: 'default' });
  if (desc?.passive)
    fields.push({
      label: '被动特性',
      content: desc.passive,
      icon: 'shield-outline',
      tone: 'default',
    });
  if (desc?.trigger)
    fields.push({
      label: '触发效果',
      content: desc.trigger,
      icon: 'locate-outline',
      tone: 'default',
    });
  if (desc?.restriction)
    fields.push({
      label: '限制条件',
      content: desc.restriction,
      icon: 'close-circle-outline',
      tone: 'warning',
    });
  if (desc?.special)
    fields.push({
      label: '特殊规则',
      content: desc.special,
      icon: 'star-outline',
      tone: 'default',
    });
  if (desc?.winCondition)
    fields.push({
      label: '胜利条件',
      content: desc.winCondition,
      icon: 'trophy-outline',
      tone: 'success',
    });

  return {
    id: roleId,
    name,
    alignment: getAlignment(displayId),
    image: getRoleAvatar(displayId),
    description: fields.length > 0 ? fields : undefined,
    factionName: getFactionName(displayId),
  };
}
