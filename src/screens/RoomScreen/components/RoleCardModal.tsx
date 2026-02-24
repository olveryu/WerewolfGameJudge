/**
 * RoleCardModal — 角色身份展示弹窗
 *
 * 根据动画配置决定渲染方式：
 * - 动画为 'none' 或无需播放 → 静态 RoleCardSimple
 * - 首次查看 → RoleRevealAnimator（带揭牌动画）
 *
 * 渲染 RoleCardSimple 或 RoleRevealAnimator，将 RoleId 转换为 RoleData
 * （alignmentMap + createRoleData），使用 React.memo 优化。不 import
 * services / showAlert / navigation，不在 onPress 里做业务 gate，
 * 不使用 StyleSheet.create（样式由父组件传入或使用共享组件）。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import {
  Faction,
  getRoleDisplayAs,
  getRoleDisplayName,
  getRoleSpec,
} from '@werewolf/game-engine/models/roles';
import type { ResolvedRoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import React, { useCallback, useState } from 'react';

import { RoleCardSimple } from '@/components/RoleCardSimple';
import {
  createRoleData,
  type RevealEffectType,
  type RoleData,
  RoleRevealAnimator,
} from '@/components/RoleRevealEffects';

// ─── Alignment map (Faction → reveal alignment) ────────────────────────────
const ALIGNMENT_MAP: Record<Faction, 'wolf' | 'god' | 'villager' | 'third'> = {
  [Faction.Wolf]: 'wolf',
  [Faction.God]: 'god',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'third',
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface RoleCardModalProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 当前角色（effectiveRole，支持接管模式） */
  roleId: RoleId;
  /** Host 解析后的动画类型（不含 random） */
  resolvedAnimation: ResolvedRoleRevealAnimation;
  /** 本次打开是否需要播放动画（首次查看 = true） */
  shouldPlayAnimation: boolean;
  /** 全部角色 ID 列表（用于动画中显示所有角色） */
  allRoleIds: RoleId[];
  /** 剩余未查看的牌数（用于 cardPick 动画） */
  remainingCards: number;
  /** 关闭回调 */
  onClose: () => void;
  /** seer+mirrorSeer 共存时的编号映射（来自 GameState） */
  seerLabelMap?: Readonly<Record<string, number>>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const RoleCardModalInner: React.FC<RoleCardModalProps> = ({
  visible,
  roleId,
  resolvedAnimation,
  shouldPlayAnimation,
  allRoleIds,
  remainingCards,
  onClose,
  seerLabelMap,
}) => {
  const [animationDone, setAnimationDone] = useState(false);

  const handleAnimationComplete = useCallback(() => {
    setAnimationDone(true);
  }, []);

  // 如果动画是 none 或不需要播放动画，直接显示静态卡片
  // 动画播完后也切到静态卡片（带"我知道了"按钮）
  // 双预言家编号：seerLabelMap 存在时，从 roleId 查找编号
  const seerLabel = seerLabelMap?.[roleId];

  if (resolvedAnimation === 'none' || !shouldPlayAnimation || animationDone) {
    return (
      <RoleCardSimple visible={visible} roleId={roleId} onClose={onClose} seerLabel={seerLabel} />
    );
  }

  // 首次查看，播放动画
  const roleSpec = getRoleSpec(roleId);
  // mirrorSeer 等有 displayAs 的角色：动画使用伪装身份
  const displayRoleId = getRoleDisplayAs(roleId) ?? roleId;
  const displaySpec = displayRoleId !== roleId ? getRoleSpec(displayRoleId) : roleSpec;
  const baseName = getRoleDisplayName(displayRoleId);
  const displayName = seerLabel != null ? `${seerLabel}号${baseName}` : baseName;
  const effectiveRoleData: RoleData = createRoleData(
    displayRoleId,
    displayName,
    ALIGNMENT_MAP[displaySpec.faction] ?? 'villager',
  );

  const allRolesData: RoleData[] = allRoleIds.map((id) => {
    const spec = getRoleSpec(id);
    return createRoleData(id, getRoleDisplayName(id), ALIGNMENT_MAP[spec.faction] ?? 'villager');
  });

  // resolvedAnimation 直接作为 effectType（Host 已解析 random → 具体动画）
  const effectType: RevealEffectType = resolvedAnimation as RevealEffectType;

  return (
    <RoleRevealAnimator
      visible={visible}
      role={effectiveRoleData}
      effectType={effectType}
      allRoles={allRolesData}
      remainingCards={remainingCards}
      onComplete={handleAnimationComplete}
    />
  );
};

export const RoleCardModal = React.memo(RoleCardModalInner);
