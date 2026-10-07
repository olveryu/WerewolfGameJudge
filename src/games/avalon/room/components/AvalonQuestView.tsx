/**
 * 阿瓦隆任务出牌：两张大卡片（金色圣杯成功 / 深色圣杯失败，D17），秘密出牌可改牌。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { type AvalonPlay, type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { borderRadius, colors, componentSizes, fixed, shadows, spacing, textStyles } from '@/theme';

import {
  formatAvalonRoundLabel,
  resolveQuestInstruction,
  resolveVoteInstruction,
} from '../policy/avalonInteractionPolicy';
import { AvalonInfoCard, AvalonStageFrame } from './AvalonStageFrame';

const PLAY_COPY: Readonly<Record<AvalonPlay, string>> = {
  success: '成功',
  fail: '失败',
};

/** 组队通过后的投票结算面板：公投亮个人票，暗投只看数量（D7）。 */
function AvalonVoteSettlement({ viewModel }: { readonly viewModel: AvalonViewModel }) {
  const instruction = resolveVoteInstruction(viewModel);
  if (instruction.ballots !== null) {
    const entries = Object.entries(instruction.ballots);
    return (
      <AvalonInfoCard title="组队通过 · 投票明细" testID="avalon-vote-settlement-public">
        {entries.map(([seatText, ballot]) => {
          const seat = Number(seatText);
          const name =
            viewModel.seats.find((seatView) => seatView.seat === seat)?.displayName ??
            `座位${seat + 1}`;
          return (
            <Text key={seat} style={styles.settlementRow}>
              {seat + 1} 号 · {name} · {PLAY_VOTE_COPY[ballot]}
            </Text>
          );
        })}
      </AvalonInfoCard>
    );
  }
  const counts = instruction.voteCounts;
  if (counts === null) return null;
  return (
    <AvalonInfoCard title="组队通过" testID="avalon-vote-settlement-secret">
      <Text style={styles.body}>
        赞成 {counts.approve} · 反对 {counts.reject} · 弃权 {counts.abstain}
      </Text>
    </AvalonInfoCard>
  );
}

const PLAY_VOTE_COPY: Readonly<Record<'approve' | 'reject', string>> = {
  approve: '赞成',
  reject: '反对',
};

/** 任务视图：队员秘密出牌（好人只看到成功卡），出牌意图上报调用方。 */
export function AvalonQuestView({
  viewModel,
  onPlay,
}: {
  readonly viewModel: AvalonViewModel;
  readonly onPlay: (play: AvalonPlay) => void;
}) {
  const instruction = resolveQuestInstruction(viewModel);
  const teamSeats = viewModel.teamSeats ?? [];
  return (
    <AvalonStageFrame
      title={`${formatAvalonRoundLabel(viewModel.questResults.length + 1)} · 任务执行`}
      testID="avalon-quest"
    >
      <AvalonVoteSettlement viewModel={viewModel} />
      <AvalonInfoCard title="本轮队员">
        {teamSeats.map((seat) => {
          const name =
            viewModel.seats.find((seatView) => seatView.seat === seat)?.displayName ??
            `座位${seat + 1}`;
          return (
            <Text key={seat} style={styles.team}>
              {seat + 1} 号 · {name}
            </Text>
          );
        })}
      </AvalonInfoCard>
      {instruction.isTeamMember ? (
        <View style={styles.cardsRow}>
          {instruction.availableCards.includes('success') ? (
            <TouchableOpacity
              style={[
                styles.card,
                styles.successCard,
                instruction.myPlay === 'success' && styles.cardSelected,
              ]}
              activeOpacity={fixed.activeOpacity}
              accessibilityRole="button"
              accessibilityLabel="成功"
              accessibilityState={{ selected: instruction.myPlay === 'success' }}
              testID="avalon-quest-success"
              onPress={() => onPlay('success')}
            >
              <Ionicons
                name="trophy-outline"
                size={componentSizes.icon.xl}
                color={colors.textInverse}
              />
              <Text style={styles.successText}>成功</Text>
            </TouchableOpacity>
          ) : null}
          {instruction.availableCards.includes('fail') ? (
            <TouchableOpacity
              style={[
                styles.card,
                styles.failCard,
                instruction.myPlay === 'fail' && styles.cardSelectedFail,
              ]}
              activeOpacity={fixed.activeOpacity}
              accessibilityRole="button"
              accessibilityLabel="失败"
              accessibilityState={{ selected: instruction.myPlay === 'fail' }}
              testID="avalon-quest-fail"
              onPress={() => onPlay('fail')}
            >
              <Ionicons
                name="skull-outline"
                size={componentSizes.icon.xl}
                color={colors.textInverse}
              />
              <Text style={styles.failText}>失败</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {instruction.isTeamMember && instruction.myPlay !== null ? (
        <Text style={styles.hint}>
          已出牌（{PLAY_COPY[instruction.myPlay]}），结算前可改牌；出牌人不公开。
        </Text>
      ) : instruction.isTeamMember ? (
        <Text style={styles.hint}>秘密出牌：点选一张卡，出牌人不公开。</Text>
      ) : (
        <Text style={styles.hint}>等待队员出牌…</Text>
      )}
    </AvalonStageFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    ...textStyles.body,
    color: colors.text,
  },
  team: {
    ...textStyles.body,
    color: colors.text,
  },
  settlementRow: {
    ...textStyles.secondary,
    color: colors.text,
  },
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    minHeight: 160,
    borderRadius: borderRadius.large,
    ...shadows.sm,
  },
  successCard: {
    backgroundColor: colors.warning,
  },
  failCard: {
    backgroundColor: colors.text,
  },
  cardSelected: {
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.primaryLight,
  },
  cardSelectedFail: {
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.primaryLight,
  },
  successText: {
    ...textStyles.titleBold,
    color: colors.textInverse,
  },
  failText: {
    ...textStyles.titleBold,
    color: colors.textInverse,
  },
});
