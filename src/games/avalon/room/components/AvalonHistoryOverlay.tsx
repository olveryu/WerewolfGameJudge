/**
 * 阿瓦隆对局记录：按轮次展示队长 / 队员 / 投票结果 / 任务结果。
 *
 * 公投记个人票，暗投记数量；任务出牌人不揭晓。
 */

import {
  type AvalonQuestHistoryView,
  type AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, spacing, textStyles } from '@/theme';

import { formatAvalonRoundLabel } from '../policy/avalonInteractionPolicy';

function seatName(viewModel: AvalonViewModel, seat: number): string {
  const entry = viewModel.seats.find((seatView) => seatView.seat === seat);
  const name = entry?.displayName ?? `座位${seat + 1}`;
  return `${seat + 1} 号 · ${name}`;
}

/** 单轮记录：队长、队员、投票结果、任务结果。 */
function AvalonHistoryRound({
  viewModel,
  entry,
}: {
  readonly viewModel: AvalonViewModel;
  readonly entry: AvalonQuestHistoryView;
}) {
  const isPublic = entry.ballots !== null;
  return (
    <View style={styles.round} testID={`avalon-history-round-${entry.round}`}>
      <Text style={styles.roundTitle}>{formatAvalonRoundLabel(entry.round)}</Text>
      <Text style={styles.row}>队长：{seatName(viewModel, entry.leaderSeat)}</Text>
      <Text style={styles.row}>队员：{entry.teamSeats.map((seat) => seat + 1).join('、')} 号</Text>
      {isPublic ? (
        <>
          <Text style={styles.row}>投票（公投）：</Text>
          {Object.entries(entry.ballots ?? {}).map(([seatText, ballot]) => {
            const seat = Number(seatText);
            return (
              <Text key={seat} style={styles.detail}>
                {seatName(viewModel, seat)} · {ballot === 'approve' ? '赞成' : '反对'}
              </Text>
            );
          })}
          <Text style={styles.detail}>
            汇总：赞成 {entry.approveCount} · 反对 {entry.rejectCount} · 弃权 {entry.abstainCount}
          </Text>
        </>
      ) : (
        <Text style={styles.row}>
          投票（暗投）：赞成 {entry.approveCount} · 反对 {entry.rejectCount} · 弃权{' '}
          {entry.abstainCount}
        </Text>
      )}
      <Text style={styles.row}>
        任务{entry.result === 'success' ? '成功' : '失败'}（成功 {entry.successCount} · 失败{' '}
        {entry.failCount}）
      </Text>
    </View>
  );
}

/** 对局记录浮层；只渲染权威历史数据。 */
export function AvalonHistoryOverlay({
  visible,
  viewModel,
  onClose,
}: {
  readonly visible: boolean;
  readonly viewModel: AvalonViewModel;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const successCount = viewModel.questResults.filter((result) => result === 'success').length;
  const failCount = viewModel.questResults.filter((result) => result === 'fail').length;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
          <Text style={styles.title}>对局记录</Text>
          <Text style={styles.summary}>
            成功 {successCount} · 失败 {failCount}
          </Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {viewModel.questHistory.length === 0 ? (
              <Text style={styles.row}>暂无已结算的轮次。</Text>
            ) : (
              viewModel.questHistory.map((entry) => (
                <AvalonHistoryRound key={entry.round} viewModel={viewModel} entry={entry} />
              ))
            )}
          </ScrollView>
          <Button variant="secondary" size="lg" onPress={onClose} testID="avalon-history-close">
            关闭
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  panel: {
    width: '100%',
    maxHeight: '80%',
    gap: spacing.small,
    padding: spacing.medium,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
  },
  title: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  summary: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  scroll: {
    minHeight: 0,
  },
  scrollContent: {
    gap: spacing.small,
  },
  round: {
    gap: spacing.tight,
    padding: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
  },
  roundTitle: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  row: {
    ...textStyles.secondary,
    color: colors.text,
  },
  detail: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
});
