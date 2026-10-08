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

import type { RevealAlignment, RevealRoleData } from '@/features/room/model/RevealRoleData';
import { getRoleAvatar } from '@/games/werewolf/assets/roleAvatars';
import { getFactionName } from '@/games/werewolf/components/roleDisplayUtils';

const ALIGNMENT_MAP: Record<Faction, RevealAlignment> = {
  [Faction.Wolf]: 'wolf',
  [Faction.God]: 'god',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'third',
};

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
  const spec = getRoleSpec(displayId);

  const name =
    opts?.seerLabel != null ? `${opts.seerLabel}号预言家` : getRoleDisplayName(displayId);

  const desc = getRoleStructuredDescription(displayId);
  const descriptionParts = [
    desc?.skill,
    desc?.passive,
    desc?.trigger,
    desc?.restriction,
    desc?.special,
  ].filter((s): s is string => typeof s === 'string' && s.length > 0);

  return {
    id: roleId,
    name,
    alignment: spec != null ? (ALIGNMENT_MAP[spec.faction] ?? 'villager') : 'villager',
    image: getRoleAvatar(displayId),
    description: descriptionParts.length > 0 ? descriptionParts.join('\n') : undefined,
    factionName: getFactionName(displayId),
  };
}
