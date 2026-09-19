/** MVP selection view; reports selection without dispatching room commands. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { useCallback, useState } from 'react';
import { FlatList, type ListRenderItemInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

interface Participant {
  userId: string;
  seat: number;
  displayName: string;
  hasLeft: boolean;
}

interface MvpSelectionModalProps {
  participants: readonly Participant[];
  goldenDraws: number;
  isSubmitting: boolean;
  onSelect: (userId: string) => Promise<void>;
  onClose: () => void;
  styles: ReturnType<typeof createMvpSelectionStyles>;
}

const participantKey = (participant: Participant) => participant.userId;

export function MvpSelectionModal({
  participants,
  goldenDraws,
  isSubmitting,
  onSelect,
  onClose,
  styles,
}: MvpSelectionModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const renderParticipant = useCallback(
    ({ item }: ListRenderItemInfo<Participant>) => (
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={`${formatSeat(item.seat)} ${item.displayName}${item.hasLeft ? '，已离房' : ''}`}
        accessibilityState={{ checked: selectedUserId === item.userId, disabled: isSubmitting }}
        disabled={isSubmitting}
        style={[styles.row, selectedUserId === item.userId && styles.selectedRow]}
        onPress={() => setSelectedUserId(item.userId)}
      >
        <View style={styles.seatBadge}>
          <Text style={styles.seatLabel}>{item.seat + 1}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.label} numberOfLines={2}>
            {item.displayName || formatSeat(item.seat)}
          </Text>
          {item.hasLeft && <Text style={styles.secondary}>已离房</Text>}
        </View>
        <Ionicons
          name={selectedUserId === item.userId ? 'checkmark-circle' : 'ellipse-outline'}
          size={componentSizes.icon.lg}
          color={selectedUserId === item.userId ? colors.primary : colors.border}
        />
      </Pressable>
    ),
    [selectedUserId, isSubmitting, styles],
  );

  return (
    <BaseCenterModal
      visible
      onClose={onClose}
      contentStyle={styles.content}
      testID="mvp-selection-modal"
    >
      <View style={styles.header}>
        <Ionicons name="trophy-outline" size={componentSizes.icon.lg} color={colors.warning} />
        <Text accessibilityRole="header" style={styles.title}>
          本局 MVP
        </Text>
        <Button
          variant="icon"
          accessibilityLabel="关闭 MVP 评选"
          disabled={isSubmitting}
          onPress={onClose}
        >
          <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
        </Button>
      </View>
      <View style={styles.reward}>
        <Text style={styles.rewardValue}>{goldenDraws}</Text>
        <View style={styles.rewardInfo}>
          <Text style={styles.rewardLabel}>次黄金抽</Text>
          <Text style={styles.secondary}>开局 {participants.length} 名真人 · 仅注册账号可领奖</Text>
        </View>
      </View>
      {goldenDraws === 0 && <Text style={styles.notice}>不足 6 名真人，本局仅评选，不发奖励</Text>}
      <FlatList
        accessibilityRole="radiogroup"
        accessibilityLabel="本局 MVP 候选玩家"
        data={participants}
        extraData={selectedUserId}
        keyExtractor={participantKey}
        renderItem={renderParticipant}
        style={styles.list}
      />
      <View style={styles.footer}>
        <Text style={styles.notice}>请在整局结束后确认，本局仅可评选一次，确认后不可更改。</Text>
        <View style={styles.actions}>
          <Button variant="ghost" onPress={onClose} disabled={isSubmitting}>
            暂不评选
          </Button>
          <Button
            style={styles.confirm}
            accessibilityLabel="确认 MVP"
            loading={isSubmitting}
            disabled={selectedUserId === null}
            onPress={() => {
              if (selectedUserId !== null) void onSelect(selectedUserId);
            }}
          >
            确认 MVP
          </Button>
        </View>
      </View>
    </BaseCenterModal>
  );
}

export function createMvpSelectionStyles() {
  return StyleSheet.create({
    content: {
      width: '92%',
      maxWidth: 480,
      height: '85%',
      maxHeight: 640,
      padding: spacing.medium,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: typography.weights.bold,
      flex: 1,
    },
    secondary: {
      color: colors.textSecondary,
      fontSize: typography.secondary,
    },
    reward: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.medium,
      paddingVertical: spacing.medium,
    },
    rewardValue: {
      color: colors.warning,
      fontSize: typography.hero,
      fontWeight: typography.weights.bold,
      fontVariant: ['tabular-nums'],
    },
    rewardInfo: { flex: 1, gap: spacing.tight },
    rewardLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
    },
    list: { flex: 1, minHeight: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: componentSizes.button.lg,
      padding: spacing.small,
      marginVertical: spacing.tight,
      borderRadius: borderRadius.medium,
      gap: spacing.medium,
    },
    selectedRow: { backgroundColor: colors.primary + '0D' },
    seatBadge: {
      width: fixed.minTouchTarget,
      height: fixed.minTouchTarget,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seatLabel: {
      color: colors.textSecondary,
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      fontVariant: ['tabular-nums'],
    },
    playerInfo: { flex: 1, gap: spacing.tight },
    label: { color: colors.text, fontSize: typography.body, flexShrink: 1 },
    footer: {
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.borderLight,
      paddingTop: spacing.medium,
      gap: spacing.small,
    },
    notice: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
    confirm: { flex: 1 },
  });
}
