/**
 * 阿瓦隆对局记录：按任务（轮次）分 tab——先任务区（结论与队伍），
 * 后投票区（历次提案：汇总行 + 逐人明细）。只用座位号，不显示玩家名。
 *
 * 公投记个人票，暗投只记数量（D7）；任务出牌人不揭晓；未结算提案
 * 只露进度与本人的一票。浮层手动开关，不自动消失，终局保留。
 */

import {
  type AvalonBallot,
  type AvalonProposalRecordView,
  type AvalonRoundRecordView,
  type AvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

import { formatAvalonQuestLabel } from '../policy/avalonInteractionPolicy';

function ballotLabel(ballot: AvalonBallot): string {
  return ballot === 'approve' ? '赞成' : '反对';
}

function teamLine(teamSeats: readonly number[], leaderSeat?: number): string {
  const seats = teamSeats.map((seat) => `${seat + 1}号`).join(' ');
  return leaderSeat === undefined ? `队伍：${seats}` : `队伍：${leaderSeat + 1}号（队长） ${seats}`;
}

/** 一条已结算提案：子标题 + 队伍 + 汇总行 + 逐人明细（暗投只给数量）。 */
function AvalonProposalBlock({
  proposal,
  index,
}: {
  readonly proposal: AvalonProposalRecordView;
  readonly index: number;
}) {
  const ballots = proposal.ballots;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>
        第{index + 1}次提案 · 队长 {proposal.leaderSeat + 1}号
      </Text>
      <Text style={styles.row}>{teamLine(proposal.teamSeats)}</Text>
      <Text style={styles.row}>
        赞成 {proposal.approveCount} · 反对 {proposal.rejectCount}
        {proposal.abstainCount > 0 ? ` · 弃权 ${proposal.abstainCount}` : ''} →{' '}
        {proposal.approved ? '通过' : '否决'}
      </Text>
      {ballots === null ? (
        <Text style={styles.detail}>暗投模式不公布逐人票</Text>
      ) : (
        <>
          <Text style={styles.row}>投票明细</Text>
          {Object.entries(ballots)
            .sort(([seatA], [seatB]) => Number(seatA) - Number(seatB))
            .map(([seatText, ballot]) => (
              <Text key={seatText} style={styles.detail}>
                {Number(seatText) + 1}号 → {ballotLabel(ballot)}
              </Text>
            ))}
        </>
      )}
    </View>
  );
}

/** 一轮记录：任务区在前（结论句 + 队伍行），投票区在后。 */
function AvalonHistoryRound({ record }: { readonly record: AvalonRoundRecordView }) {
  const questLabel = formatAvalonQuestLabel(record.round);
  const currentProposal = record.currentProposal;
  const approvedProposal = [...record.proposals].reverse().find((proposal) => proposal.approved);
  return (
    <View style={styles.round} testID={`avalon-history-round-${record.round}`}>
      {record.quest !== null ? (
        <>
          <Text style={styles.roundTitle}>
            {questLabel} · {record.quest.result === 'success' ? '成功' : '失败'}（成功票{' '}
            {record.quest.successCount} · 失败票 {record.quest.failCount}）
          </Text>
          {approvedProposal !== undefined ? (
            <Text style={styles.row}>
              {teamLine(approvedProposal.teamSeats, approvedProposal.leaderSeat)}
            </Text>
          ) : null}
        </>
      ) : record.vetoEnded ? (
        <Text style={styles.roundTitle}>
          组队失败：{record.proposals.length} 次否决达上限，本轮无任务
        </Text>
      ) : record.questProgress !== null ? (
        <>
          <Text style={styles.roundTitle}>
            {questLabel} · 任务执行中（已出牌 {record.questProgress.playedCount}/
            {record.questProgress.teamSize}）
          </Text>
          {approvedProposal !== undefined ? (
            <Text style={styles.row}>
              {teamLine(approvedProposal.teamSeats, approvedProposal.leaderSeat)}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.roundTitle}>{questLabel} · 组队投票中</Text>
      )}
      {record.proposals.map((proposal, index) => (
        <AvalonProposalBlock key={`${record.round}-${index}`} proposal={proposal} index={index} />
      ))}
      {currentProposal !== null ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>
            第{record.proposals.length + 1}次提案 · 队长 {currentProposal.leaderSeat + 1}号
          </Text>
          <Text style={styles.row}>{teamLine(currentProposal.teamSeats)}</Text>
          <Text style={styles.row}>
            进行中（已投 {currentProposal.castCount}/{currentProposal.totalCount}）
          </Text>
          {currentProposal.myBallot !== null ? (
            <Text style={styles.detail}>你投了：{ballotLabel(currentProposal.myBallot)}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** 对局记录浮层：tab 只含已开始轮次，默认当前轮；只渲染权威记录投影。 */
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
  const rounds = viewModel.roundHistory;
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  // 每次打开回到默认 tab（当前轮）。
  useEffect(() => {
    if (visible) setSelectedRound(null);
  }, [visible]);
  const active =
    rounds.find((record) => record.round === selectedRound) ?? rounds[rounds.length - 1];
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
          {rounds.length > 1 ? (
            <View style={styles.tabRow}>
              {rounds.map((record) => {
                const isActive = active !== undefined && record.round === active.round;
                return (
                  <TouchableOpacity
                    key={record.round}
                    style={[styles.tab, isActive ? styles.tabActive : null]}
                    activeOpacity={fixed.activeOpacity}
                    accessibilityRole="button"
                    accessibilityLabel={formatAvalonQuestLabel(record.round)}
                    testID={`avalon-history-tab-${record.round}`}
                    onPress={() => setSelectedRound(record.round)}
                  >
                    <Text style={styles.tabText}>{formatAvalonQuestLabel(record.round)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {active === undefined ? (
              <Text style={styles.row}>暂无对局记录。</Text>
            ) : (
              <AvalonHistoryRound key={active.round} record={active} />
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
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  tab: {
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    ...textStyles.secondary,
    color: colors.text,
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
  block: {
    gap: spacing.tight,
  },
  blockTitle: {
    ...textStyles.secondarySemibold,
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
