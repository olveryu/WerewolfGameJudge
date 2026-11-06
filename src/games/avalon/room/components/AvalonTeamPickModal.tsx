/**
 * 阿瓦隆组队选人弹窗：组队阶段的唯一选人入口（板子点选已停用）。
 * 从底部弹起的 bottom sheet：名单多选、满员才能确认，确认即提交——
 * 预选 modal 确认后记预选锁定记录，最终 modal 打开时预选那套已勾好、
 * 只改差量。选人过程是 modal 本地状态，取消不留痕；确认后由调用方
 * 先同步草稿再发预选 / 提交，服务端回声才是全房可见的阵容。
 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, fixed, shadows, spacing, textStyles, typography } from '@/theme';

export type AvalonTeamPickKind = 'preselect' | 'final';

function seatName(viewModel: AvalonViewModel, seat: number): string {
  const entry = viewModel.seats.find((seatView) => seatView.seat === seat);
  return `${seat + 1} 号 · ${entry?.displayName ?? `座位${seat + 1}`}`;
}

/** 组队选人弹窗：名单多选、满员确认，意图上报调用方；提交中禁用防重复提交。 */
export function AvalonTeamPickModal({
  viewModel,
  kind,
  isSubmitting,
  onConfirm,
  onClose,
}: {
  readonly viewModel: AvalonViewModel;
  readonly kind: AvalonTeamPickKind;
  readonly isSubmitting: boolean;
  readonly onConfirm: (seats: readonly number[]) => void;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const requiredSize = viewModel.requiredSize ?? 0;
  const preselected = viewModel.preselectedSeats ?? [];
  const [selection, setSelection] = useState<readonly number[]>(() =>
    kind === 'final' ? preselected : [],
  );
  const [fullHint, setFullHint] = useState<string | null>(null);
  const isFull = selection.length === requiredSize;
  const confirmLabel = kind === 'preselect' ? '确认预选' : '确认提交';
  const hint =
    kind === 'preselect'
      ? '确认后预选即锁定、全房可见；随后可调整最终队伍，预选记录不动。'
      : `提交后立即进入投票，无法再改；本轮被否决会计入否决串，累计 ${viewModel.vetoLimit} 次否决坏人直接获胜。`;

  const toggle = (seat: number) => {
    if (selection.includes(seat)) {
      setSelection(selection.filter((picked) => picked !== seat));
      setFullHint(null);
      return;
    }
    if (selection.length >= requiredSize) {
      setFullHint('已满员，取消已选座位后再选。');
      return;
    }
    setSelection([...selection, seat]);
    setFullHint(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
          testID="avalon-team-pick-modal"
        >
          <View style={styles.header}>
            <Text style={styles.title}>{kind === 'preselect' ? '预选队伍' : '最终队伍'}</Text>
            <Text style={styles.count} testID="avalon-team-pick-count">
              已选 {selection.length}/{requiredSize}
            </Text>
          </View>
          <Text style={styles.hint}>{hint}</Text>
          {viewModel.seats.map((seatView) => {
            const seat = seatView.seat;
            const checked = selection.includes(seat);
            return (
              <TouchableOpacity
                key={seat}
                style={styles.row}
                activeOpacity={fixed.activeOpacity}
                accessibilityRole="button"
                accessibilityLabel={seatName(viewModel, seat)}
                accessibilityState={{ selected: checked, disabled: isSubmitting }}
                disabled={isSubmitting}
                testID={`avalon-team-pick-row-${seat}`}
                onPress={() => toggle(seat)}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={styles.rowLabel}>{seatName(viewModel, seat)}</Text>
                {seat === viewModel.leaderSeat ? <Text style={styles.leaderTag}>队长</Text> : null}
                {kind === 'final' && preselected.includes(seat) ? (
                  <Text style={styles.preselectedTag}>预选</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
          {fullHint !== null ? <Text style={styles.fullHint}>{fullHint}</Text> : null}
          <View style={styles.footer}>
            <Button
              variant="secondary"
              size="lg"
              onPress={onClose}
              testID="avalon-team-pick-cancel"
            >
              取消
            </Button>
            {isFull && !isSubmitting ? (
              <Button
                variant="primary"
                size="lg"
                onPress={() => onConfirm(selection)}
                testID="avalon-team-pick-confirm"
              >
                {confirmLabel}
              </Button>
            ) : (
              <Button variant="primary" size="lg" disabled testID="avalon-team-pick-confirm">
                {confirmLabel}
              </Button>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  panel: {
    width: '100%',
    gap: spacing.small,
    padding: spacing.large,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    backgroundColor: colors.card,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...textStyles.titleBold,
    color: colors.text,
  },
  count: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.small,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    ...textStyles.body,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
  rowLabel: {
    ...textStyles.body,
    color: colors.text,
    flex: 1,
  },
  leaderTag: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  preselectedTag: {
    ...textStyles.secondary,
    color: colors.primary,
  },
  fullHint: {
    ...textStyles.secondary,
    color: colors.warning,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.small,
    marginTop: spacing.small,
  },
});
