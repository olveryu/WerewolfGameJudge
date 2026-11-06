/**
 * 阿瓦隆投票结算面板（设计稿 §7 412 行）：全员可见的投票结论展示。
 *
 * 结论横幅（组队通过 / 组队被否决·第 N 次）+ 公投逐人投票（座位号·名字·赞成/反对/弃权）/
 * 暗投仅汇总数量。6 秒自动关闭，也可手动点"知道了"关闭；展示后游戏自动进入下一阶段。
 */

import type {
  AvalonBallot,
  AvalonLastVoteResultView,
  AvalonSeatView,
} from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, spacing, textStyles } from '@/theme';

/** 结算面板自动关闭时长（412 行"展示后自动进下一阶段"；D4 的"无计时"指游戏逻辑 deadline）。 */
const VOTE_RESULT_AUTO_DISMISS_MS = 6000;

const BALLOT_LABEL: Record<AvalonBallot, string> = {
  approve: '赞成',
  reject: '反对',
};

interface AvalonVoteResultPanelProps {
  readonly result: AvalonLastVoteResultView;
  readonly seats: readonly AvalonSeatView[];
  readonly onClose: () => void;
}

function seatLabel(seat: number, name: string): string {
  return `${seat + 1} 号 · ${name}`;
}

/** 投票结算面板；挂载即开始 6 秒倒计时，到时或手动"知道了"都走 onClose。 */
export function AvalonVoteResultPanel({ result, seats, onClose }: AvalonVoteResultPanelProps) {
  const insets = useSafeAreaInsets();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), VOTE_RESULT_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);
  const orderedSeats = [...seats].sort((a, b) => a.seat - b.seat);
  const isPublic = result.ballots !== null;
  const banner = result.approved ? '组队通过' : `组队被否决·第 ${result.rejectStreak} 次`;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
          testID="avalon-vote-result-panel"
        >
          <Text
            style={[styles.banner, result.approved ? styles.bannerApproved : styles.bannerRejected]}
            testID="avalon-vote-result-banner"
          >
            {banner}
          </Text>
          {isPublic ? (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {orderedSeats.map((seatView) => {
                const ballot = result.ballots?.[seatView.seat];
                return (
                  <Text
                    key={seatView.seat}
                    style={styles.row}
                    testID={`avalon-vote-result-row-${seatView.seat}`}
                  >
                    {seatLabel(seatView.seat, seatView.displayName)} ·{' '}
                    {ballot === undefined ? '弃权' : BALLOT_LABEL[ballot]}
                  </Text>
                );
              })}
              <Text style={styles.summary}>
                汇总：赞成 {result.approveCount} · 反对 {result.rejectCount} · 弃权{' '}
                {result.abstainCount}
              </Text>
            </ScrollView>
          ) : (
            <Text style={styles.summary} testID="avalon-vote-result-counts">
              赞成 {result.approveCount} · 反对 {result.rejectCount} · 弃权 {result.abstainCount}
            </Text>
          )}
          <Button variant="secondary" size="lg" onPress={onClose} testID="avalon-vote-result-close">
            知道了
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  panel: {
    width: '85%',
    maxHeight: '80%',
    gap: spacing.medium,
    padding: spacing.medium,
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
  },
  banner: {
    ...textStyles.title,
    textAlign: 'center',
  },
  bannerApproved: {
    color: colors.success,
  },
  bannerRejected: {
    color: colors.error,
  },
  list: {
    minHeight: 0,
  },
  listContent: {
    gap: spacing.tight,
  },
  row: {
    ...textStyles.secondary,
    color: colors.text,
  },
  summary: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
