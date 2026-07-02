/**
 * RoleCardModal — Role identity reveal modal
 *
 * Chooses render mode based on animation config:
 * - Animation is 'none' or should not play → static RoleCardSimple
 * - First view → RoleRevealAnimator (with reveal animation)
 *
 * Renders RoleCardSimple or RoleRevealAnimator, converting RoleId to RoleData
 * (alignmentMap + createRoleData), optimized with React.memo. No
 * service / showAlert / navigation imports; no business gate in onPress,
 * no StyleSheet.create (styles passed from parent or via shared components).
 */

import type { ResolvedRoleRevealAnimation } from '@werewolf/game-engine/cosmetics/roleRevealEffects';
import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import {
  Faction,
  getRoleDisplayAs,
  getRoleDisplayName,
  getRoleSpec,
} from '@werewolf/game-engine/werewolf/models/roles';
import { Asset } from 'expo-asset';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Modal } from '@/components/AppModal';
import { LoadingScreen } from '@/components/LoadingScreen/LoadingScreen';
import { RoleCardSimple } from '@/components/RoleCardSimple';
import {
  createRoleData,
  type RevealEffectType,
  type RoleData,
  RoleRevealAnimator,
} from '@/components/RoleRevealEffects';
import { isAIChatReady } from '@/services/feature/AIChatService';
import { askAIAboutRole } from '@/utils/aiChatBridge';
import { getRoleAvatar } from '@/utils/avatar';
import { log } from '@/utils/logger';

// ─── Alignment map (Faction → reveal alignment) ────────────────────────────
const ALIGNMENT_MAP: Record<Faction, 'wolf' | 'god' | 'villager' | 'third'> = {
  [Faction.Wolf]: 'wolf',
  [Faction.God]: 'god',
  [Faction.Villager]: 'villager',
  [Faction.Special]: 'third',
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface RoleCardModalProps {
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
  /** Label map for seer+mirrorSeer co-existence scenarios (from WerewolfState). */
  seerLabelMap?: Readonly<Record<string, number>>;
}

// ─── Component ──────────────────────────────────────────────────────────────

const RoleCardModalInner: React.FC<RoleCardModalProps> = ({
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
  const [animationDone, setAnimationDone] = useState(false);

  // Preload role avatar image during animation so it's decoded when the card flips
  useEffect(() => {
    if (visible) {
      const targetRoleId = getRoleDisplayAs(roleId) ?? roleId;
      Asset.loadAsync(getRoleAvatar(targetRoleId)).catch((e) => {
        log.warn('Failed to preload role avatar', e);
      });
    }
  }, [visible, roleId]);

  const handleAnimationComplete = useCallback(() => {
    setAnimationDone(true);
  }, []);

  const allRolesData: RoleData[] = useMemo(
    () =>
      allRoleIds.map((id) => {
        const spec = getRoleSpec(id);
        return createRoleData(
          id,
          getRoleDisplayName(id),
          ALIGNMENT_MAP[spec.faction] ?? 'villager',
        );
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

  // If animation is 'none' or should not play, show the static card directly
  // Also switch to static card after animation completes (with "我知道了" button)
  // Dual seer label: look up label from roleId when seerLabelMap is present
  const seerLabel = seerLabelMap?.[roleId];

  if (resolvedAnimation === 'none' || !shouldPlayAnimation || animationDone) {
    return (
      <RoleCardSimple
        visible={visible}
        roleId={roleId}
        onClose={onClose}
        seerLabel={seerLabel}
        onAskAI={isAIChatReady() ? (rid) => askAIAboutRole(rid, onClose) : undefined}
      />
    );
  }

  // First view: play animation
  const roleSpec = getRoleSpec(roleId);
  // Roles with displayAs (e.g., mirrorSeer): animation uses the disguised identity
  const displayRoleId = getRoleDisplayAs(roleId) ?? roleId;
  const displaySpec = displayRoleId !== roleId ? getRoleSpec(displayRoleId) : roleSpec;
  const baseName = getRoleDisplayName(displayRoleId);
  const displayName = seerLabel != null ? `${seerLabel}号${baseName}` : baseName;
  const effectiveRoleData: RoleData = createRoleData(
    displayRoleId,
    displayName,
    ALIGNMENT_MAP[displaySpec.faction] ?? 'villager',
  );

  // resolvedAnimation is used directly as effectType (host has already resolved random → specific animation)
  const effectType: RevealEffectType = resolvedAnimation;

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
