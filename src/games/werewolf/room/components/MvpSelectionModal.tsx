/** MVP selection view; reports selection without dispatching room commands. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { useCallback } from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { colors, spacing, typography } from '@/theme';

interface Participant {
  userId: string;
  seat: number;
  displayName: string;
}

interface MvpSelectionModalProps {
  participants: readonly Participant[];
  goldenDraws: number;
  onSelect: (userId: string | null) => void;
  onClose: () => void;
  styles: ReturnType<typeof createMvpSelectionStyles>;
}

const participantKey = (participant: Participant) => participant.userId;

export function MvpSelectionModal({
  participants,
  goldenDraws,
  onSelect,
  onClose,
  styles,
}: MvpSelectionModalProps) {
  const renderParticipant = useCallback(
    ({ item }: ListRenderItemInfo<Participant>) => (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`评选 ${formatSeat(item.seat)} ${item.displayName} 为 MVP`}
        style={styles.row}
        onPress={() => onSelect(item.userId)}
      >
        <Text style={styles.label}>
          {formatSeat(item.seat)} {item.displayName}
        </Text>
        <Ionicons name="chevron-forward" size={typography.subtitle} color={colors.textSecondary} />
      </TouchableOpacity>
    ),
    [onSelect, styles],
  );

  return (
    <BaseCenterModal
      visible
      onClose={onClose}
      contentStyle={styles.content}
      testID="mvp-selection-modal"
    >
      <Text accessibilityRole="header" style={styles.title}>
        本局 MVP
      </Text>
      <Text style={styles.subtitle}>
        {goldenDraws === 0
          ? '开局不足 6 名真人，本局无 MVP 奖励'
          : `MVP 奖励：${goldenDraws} 次黄金抽（仅注册账号）`}
      </Text>
      <FlatList
        data={participants}
        keyExtractor={participantKey}
        renderItem={renderParticipant}
        style={styles.list}
      />
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.action}>
          <Text style={styles.label}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onSelect(null)}
          style={styles.action}
        >
          <Text style={styles.primary}>跳过 MVP</Text>
        </TouchableOpacity>
      </View>
    </BaseCenterModal>
  );
}

export function createMvpSelectionStyles() {
  return StyleSheet.create({
    content: { width: '90%', maxWidth: 480, height: '70%', maxHeight: '80%' },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: typography.weights.bold,
      marginBottom: spacing.small,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.secondary,
      marginBottom: spacing.medium,
    },
    list: { flex: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.medium,
      gap: spacing.small,
    },
    label: { color: colors.text, fontSize: typography.body, flexShrink: 1 },
    actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.medium },
    action: { padding: spacing.small },
    primary: { color: colors.primary, fontSize: typography.body },
  });
}
