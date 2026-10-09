/**
 * WerewolfRoleCardModal — 狼人杀角色揭示弹窗（狼人杀专属）。
 *
 * 共享层提供 RoleCardSimple / RoleRevealAnimator / RevealRoleData；
 * 本组件是狼人杀的组装：RoleId → RevealRoleData 转换、双预言家标签、
 * AI 攻略入口、头像预加载。阿瓦隆有自己的薄组装（AvalonRoleCardModal）。
 *
 * Chooses render mode based on animation config:
 * - Animation is 'none' or should not play → static RoleCardSimple
 * - First view → RoleRevealAnimator (with reveal animation)
 *
 * The play-once gating itself is the shared RevealAnimationGate
 * (Identity Viewing Protocol): this component only converts RoleId to
 * RevealRoleData and supplies the anchor and animation data.
 * Renders RoleCardSimple or RoleRevealAnimator, converting RoleId to RoleData
 * (alignmentMap + createRoleData), optimized with React.memo. No
 * service / showAlert / navigation imports; no business gate in onPress,
 * no StyleSheet.create (styles passed from parent or via shared components).
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import {
  Faction,
  getRoleDisplayAs,
  getRoleDisplayName,
  getRoleSpec,
} from '@game-judge/game-engine/games/werewolf/public';
import type { ResolvedRoleRevealAnimation } from '@game-judge/game-engine/product/rewards';
import { Asset } from 'expo-asset';
import React, { useEffect, useMemo } from 'react';

import { Modal } from '@/components/AppModal';
import { LoadingScreen } from '@/components/LoadingScreen/LoadingScreen';
import { RevealAnimationGate } from '@/features/room/components/RevealAnimationGate';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import { getRoleAvatar } from '@/games/werewolf/assets/roleAvatars';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { askAIAboutRole } from '@/games/werewolf/services/aiChatBridge';
import { isAIChatReady } from '@/games/werewolf/services/AIChatService';
import { log } from '@/utils/logger';

// ─── Alignment map (Faction → reveal alignment) ────────────────────────────
const ALIGNMENT_MAP: Record<Faction, 'wolf' | 'god' | 'villager' | 'third'> = {
  [Faction.Wolf]: 'wolf',
  [Faction.God]: 'god',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'third',
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface WerewolfRoleCardModalProps {
  /** Whether the modal is visible. */
  visible: boolean;
  /** Awaiting server confirmation; shows a loading animation. */
  isLoading?: boolean;
  /** Current role (effectiveRole, supports takeover mode). */
  roleId: RoleId;
  /** Animation type resolved by the host (excludes 'random'). */
  resolvedAnimation: ResolvedRoleRevealAnimation;
  /** Whether the animation should play for this open (true on first view). */
  shouldPlayAnimation: boolean;
  /** Full list of role IDs (used to display all roles during the animation). */
  allRoleIds: RoleId[];
  /** Number of cards not yet viewed (used for the cardPick animation). */
  remainingCards: number;
  /** Close callback. */
  onClose: () => void;
  /** Label map for seer+mirrorSeer co-existence scenarios (from GameState). */
  seerLabelMap?: Readonly<Record<string, number>>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const WerewolfRoleCardModalInner: React.FC<WerewolfRoleCardModalProps> = ({
  visible,
  isLoading,
  roleId,
  resolvedAnimation,
  shouldPlayAnimation,
  allRoleIds,
  remainingCards,
  onClose,
  seerLabelMap,
}) => {
  // Preload role avatar image during animation so it's decoded when the card flips
  useEffect(() => {
    if (visible) {
      const targetRoleId = getRoleDisplayAs(roleId) ?? roleId;
      Asset.loadAsync(getRoleAvatar(targetRoleId)).catch((e) => {
        log.warn('Failed to preload role avatar', e);
      });
    }
  }, [visible, roleId]);

  const allRolesData: RevealRoleData[] = useMemo(
    () =>
      allRoleIds.map((id) => {
        const spec = getRoleSpec(id);
        return {
          id,
          name: getRoleDisplayName(id),
          alignment: ALIGNMENT_MAP[spec.faction] ?? 'villager',
        };
      }),
    [allRoleIds],
  );

  // ── Loading state: awaiting server confirmation ──
  if (isLoading) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <LoadingScreen message="正在确认身份…" />
      </Modal>
    );
  }

  // Dual seer label: look up label from roleId when seerLabelMap is present
  const seerLabel = seerLabelMap?.[roleId];

  // Roles with displayAs (e.g., mirrorSeer): animation uses the disguised identity
  const roleSpec = getRoleSpec(roleId);
  const displayRoleId = getRoleDisplayAs(roleId) ?? roleId;
  const displaySpec = displayRoleId !== roleId ? getRoleSpec(displayRoleId) : roleSpec;
  const baseName = getRoleDisplayName(displayRoleId);
  const displayName = seerLabel != null ? `${seerLabel}号${baseName}` : baseName;
  const effectiveRoleData: RevealRoleData = {
    id: displayRoleId,
    name: displayName,
    alignment: ALIGNMENT_MAP[displaySpec.faction] ?? 'villager',
  };

  // The shared gate owns the play-once mechanics: it renders the
  // animator on the first view (resolvedAnimation already has 'random'
  // resolved by the host; 'none' maps to no effect) and the static card
  // otherwise / after completion.
  return (
    <RevealAnimationGate
      visible={visible}
      effectType={resolvedAnimation === 'none' ? null : resolvedAnimation}
      shouldPlay={shouldPlayAnimation}
      role={effectiveRoleData}
      allRoles={allRolesData}
      remainingCards={remainingCards}
    >
      <RoleCardSimple
        visible={visible}
        roleId={roleId}
        onClose={onClose}
        seerLabel={seerLabel}
        onAskAI={isAIChatReady() ? (rid) => askAIAboutRole(rid, onClose) : undefined}
      />
    </RevealAnimationGate>
  );
};

export const WerewolfRoleCardModal = React.memo(WerewolfRoleCardModalInner);
