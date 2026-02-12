/**
 * RoleCardModal — 角色身份展示弹窗
 *
 * 根据动画配置决定渲染方式：
 * - 动画为 'none' 或无需播放 → 静态 RoleCardSimple
 * - 首次查看 → RoleRevealAnimator（带揭牌动画）
 *
 * ✅ Allowed:
 *   - 渲染 RoleCardSimple 或 RoleRevealAnimator
 *   - 将 RoleId 转换为 RoleData（alignmentMap + createRoleData）
 *   - React.memo 优化
 *
 * ❌ Do NOT:
 *   - import services / showAlert / navigation
 *   - 在 onPress 里做业务 gate
 *   - 使用 StyleSheet.create（样式由父组件传入或使用共享组件）
 */

import React, { useCallback, useState } from 'react';

import { RoleCardSimple } from '@/components/RoleCardSimple';
import {
  createRoleData,
  type RevealEffectType,
  type RoleData,
  RoleRevealAnimator,
} from '@/components/RoleRevealEffects';
import type { RoleId } from '@/models/roles';
import { Faction, getRoleDisplayName, getRoleSpec } from '@/models/roles';
import type { ResolvedRoleRevealAnimation } from '@/types/RoleRevealAnimation';

// ─── Alignment map (Faction → reveal alignment) ────────────────────────────
const ALIGNMENT_MAP: Record<Faction, 'wolf' | 'god' | 'villager'> = {
  [Faction.Wolf]: 'wolf',
  [Faction.God]: 'god',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'villager', // Special 归类为 villager
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
  /** 关闭回调 */
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const RoleCardModalInner: React.FC<RoleCardModalProps> = ({
  visible,
  roleId,
  resolvedAnimation,
  shouldPlayAnimation,
  allRoleIds,
  onClose,
}) => {
  const [animationDone, setAnimationDone] = useState(false);

  const handleAnimationComplete = useCallback(() => {
    setAnimationDone(true);
  }, []);

  // 如果动画是 none 或不需要播放动画，直接显示静态卡片
  // 动画播完后也切到静态卡片（带"我知道了"按钮）
  if (resolvedAnimation === 'none' || !shouldPlayAnimation || animationDone) {
    return <RoleCardSimple visible={visible} roleId={roleId} onClose={onClose} />;
  }

  // 首次查看，播放动画
  const roleSpec = getRoleSpec(roleId);
  const effectiveRoleData: RoleData = createRoleData(
    roleId,
    getRoleDisplayName(roleId),
    ALIGNMENT_MAP[roleSpec.faction] ?? 'villager',
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
      onComplete={handleAnimationComplete}
    />
  );
};

export const RoleCardModal = React.memo(RoleCardModalInner);
