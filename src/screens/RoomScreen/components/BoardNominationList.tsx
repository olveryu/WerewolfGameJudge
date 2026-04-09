/**
 * BoardNominationModal — 板子建议居中弹窗
 *
 * 显示所有板子建议，卡片风格与 BoardPickerScreen 展开卡一致（复用 FactionRoleList）。
 * 每张卡片显示提交人 + 阵营统计 badge + 分阵营 FactionChip + 点赞/撤回/采纳按钮。
 * 由 BoardInfoCard 的"查看建议"按钮打开。
 */
import { Ionicons } from '@expo/vector-icons';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { createCustomTemplate, getPlayerCount } from '@werewolf/game-engine/models/Template';
import type { BoardNomination } from '@werewolf/game-engine/protocol/types';
import { memo, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { FactionRoleList } from '@/components/FactionRoleList';
import { useGameFacade } from '@/contexts/GameFacadeContext';
import {
  borderRadius,
  componentSizes,
  spacing,
  textStyles,
  typography,
  useColors,
  withAlpha,
} from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';

interface BoardNominationModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** uid → BoardNomination record */
  nominations: Readonly<Record<string, BoardNomination>> | undefined;
  /** Current user's uid */
  myUid: string | null;
  /** Whether current user is host */
  isHost: boolean;
  /** Current template player count (for mismatch detection) */
  currentPlayerCount: number;
  /** Upvote a nomination */
  onUpvote: (targetUid: string) => void;
  /** Withdraw own nomination */
  onWithdraw: () => void;
  /** Clear all seats (called before adopt when player count changes) */
  clearAllSeats: () => Promise<void>;
  /** Close the modal */
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// NominationCard — single nomination rendered as a BoardPicker-style card
// ─────────────────────────────────────────────────────────────────────────────

function NominationCard({
  nomination,
  myUid,
  isHost,
  onUpvote,
  onWithdraw,
  onAdopt,
}: {
  nomination: BoardNomination;
  myUid: string | null;
  isHost: boolean;
  onUpvote: (targetUid: string) => void;
  onWithdraw: () => void;
  onAdopt: (roles: readonly RoleId[]) => Promise<void>;
}) {
  const colors = useColors();
  const isMine = nomination.uid === myUid;
  const hasUpvoted = myUid ? nomination.upvoters.includes(myUid) : false;
  const roles = nomination.roles as RoleId[];
  const nominationPlayerCount = getPlayerCount(roles);
  const handleUpvote = useCallback(() => {
    onUpvote(nomination.uid);
  }, [nomination.uid, onUpvote]);

  const handleAdopt = useCallback(() => {
    onAdopt(nomination.roles);
  }, [nomination.roles, onAdopt]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {/* Header: author + player count */}
      <View style={styles.cardHeader}>
        <Text style={[styles.cardAuthor, { color: colors.text }]} numberOfLines={1}>
          {nomination.displayName}
          {isMine && <Text style={{ color: colors.textSecondary }}> (我)</Text>}
        </Text>
        <View style={[styles.playerBadge, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
          <Text style={[styles.playerBadgeText, { color: colors.primary }]}>
            {nominationPlayerCount}人
          </Text>
        </View>
      </View>

      {/* Faction stats + chip rows (shared component) */}
      <View style={styles.roleListSpacing}>
        <FactionRoleList roles={roles} />
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {/* Upvote toggle button */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              backgroundColor: hasUpvoted
                ? withAlpha(colors.primary, 0.15)
                : withAlpha(colors.textSecondary, 0.1),
            },
          ]}
          onPress={handleUpvote}
        >
          <Ionicons
            name={hasUpvoted ? 'thumbs-up' : 'thumbs-up-outline'}
            size={componentSizes.icon.sm}
            color={hasUpvoted ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.actionBtnText,
              { color: hasUpvoted ? colors.primary : colors.textSecondary },
            ]}
          >
            {nomination.upvoters.length > 0 ? `${nomination.upvoters.length}` : '点赞'}
          </Text>
        </TouchableOpacity>

        {/* Withdraw button (own nomination) */}
        {isMine && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: withAlpha(colors.error, 0.1) }]}
            onPress={onWithdraw}
          >
            <Ionicons
              name="close-circle-outline"
              size={componentSizes.icon.sm}
              color={colors.error}
            />
            <Text style={[styles.actionBtnText, { color: colors.error }]}>撤回</Text>
          </TouchableOpacity>
        )}

        {/* Adopt button (host only) */}
        {isHost && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: withAlpha(colors.primary, 0.15) }]}
            onPress={handleAdopt}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={componentSizes.icon.sm}
              color={colors.primary}
            />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>采纳</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

export const BoardNominationModal = memo(function BoardNominationModal({
  visible,
  nominations,
  myUid,
  isHost,
  currentPlayerCount,
  onUpvote,
  onWithdraw,
  clearAllSeats,
  onClose,
}: BoardNominationModalProps) {
  const colors = useColors();
  const facade = useGameFacade();

  const handleAdopt = useCallback(
    async (roles: readonly RoleId[]) => {
      const newCount = getPlayerCount(roles as RoleId[]);
      if (newCount !== currentPlayerCount) {
        await clearAllSeats();
      }
      const template = createCustomTemplate([...roles]);
      const result = await facade.updateTemplate(template);
      if (!result.success) {
        showErrorAlert('采纳失败', result.reason ?? '请稍后重试');
      }
      onClose();
    },
    [currentPlayerCount, clearAllSeats, facade, onClose],
  );

  const entries = useMemo(() => {
    if (!nominations) return [];
    return Object.values(nominations).sort((a, b) => b.upvoters.length - a.upvoters.length);
  }, [nominations]);

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      contentStyle={styles.modalContent}
    >
      <View style={styles.modalHeader}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>板子建议 ({entries.length})</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {entries.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>还没有人提建议</Text>
        ) : (
          entries.map((nomination) => (
            <NominationCard
              key={nomination.uid}
              nomination={nomination}
              myUid={myUid}
              isHost={isHost}
              onUpvote={onUpvote}
              onWithdraw={onWithdraw}
              onAdopt={handleAdopt}
            />
          ))
        )}
      </ScrollView>
    </BaseCenterModal>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Modal content box
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    padding: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
  },
  modalTitle: {
    ...textStyles.subtitleSemibold,
  },
  scrollArea: {
    paddingHorizontal: spacing.medium,
  },
  scrollContent: {
    paddingBottom: spacing.medium,
  },
  emptyText: {
    ...textStyles.caption,
    textAlign: 'center',
    paddingVertical: spacing.medium,
  },

  // Card
  card: {
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    marginBottom: spacing.small,
  },
  cardAuthor: {
    ...textStyles.bodySemibold,
    flex: 1,
  },
  playerBadge: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.full,
  },
  playerBadgeText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  roleListSpacing: {
    marginBottom: spacing.small,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingTop: spacing.small,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.small,
  },
  actionBtnText: {
    ...textStyles.caption,
    fontWeight: typography.weights.medium,
  },
});
