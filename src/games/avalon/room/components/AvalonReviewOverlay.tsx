/**
 * 阿瓦隆本局复盘：终局后才开的完整结算面，座位表上方不留任何结算内容。
 *
 * 段顺序固定：① 终局结论（复用 AVALON_END_REASON_COPY +
 * resolveEndedInstruction，不新写文案表）② 全员身份（结构化行，不用
 * “·”连读串）③ 配置 ④ 湖仙查验完整版（共享 AvalonRecordLakeSection，
 * 未发生轮次写具体原因）⑤ 任务进程（共享 AvalonRecordTrack +
 * AvalonRecordRound，与对局记录同一份实现）。只在 phase === 'ended'
 * 时渲染内容；非终局返回 null，入口本身也只在终局出现。
 */

import {
  AVALON_LADY_MIN_PLAYERS,
  AVALON_LADY_ROUNDS,
  AVALON_QUEST_SIZES,
  type AvalonViewModel,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { SeatDot } from '@/components/SeatDot';
import { borderRadius, colors, spacing, textStyles, typography } from '@/theme';

import {
  getAvalonFactionDisplayName,
  getAvalonRoleDisplayName,
} from '../../model/avalonRoleDisplay';
import { createAvalonBoardInfoSections } from '../avalonRoomAdapter';
import { AVALON_END_REASON_COPY, resolveEndedInstruction } from '../policy/avalonInteractionPolicy';
import { AvalonRecordLakeSection } from './AvalonRecordLakeSection';
import { AvalonRecordRound } from './AvalonRecordRound';
import { AvalonRecordTrack } from './AvalonRecordTrack';

export function AvalonReviewOverlay({
  visible,
  viewModel,
  onClose,
}: {
  readonly visible: boolean;
  readonly viewModel: AvalonViewModel;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (viewModel.phase !== 'ended') return null;
  const instruction = resolveEndedInstruction(viewModel);
  const copy = AVALON_END_REASON_COPY[instruction.reason];
  const isGoodWin = instruction.winner === 'good';
  const isHit =
    instruction.reason === 'assassinationHit' || instruction.reason === 'earlyAssassinationHit';
  const assassinSeat =
    viewModel.seats.find((seatView) => seatView.role === 'assassin')?.seat ?? null;
  const accusedSeatView =
    instruction.accusedSeat === null
      ? null
      : (viewModel.seats.find((seatView) => seatView.seat === instruction.accusedSeat) ?? null);
  const accusedRole =
    accusedSeatView === null || accusedSeatView.role === null
      ? '未知'
      : getAvalonRoleDisplayName(accusedSeatView.role);
  const assassinLine =
    accusedSeatView === null
      ? null
      : assassinSeat === null
        ? `刺客指认了 ${accusedSeatView.seat + 1} 号（${accusedRole}）→ ${isHit ? '命中' : '未命中'}`
        : `刺客 ${assassinSeat + 1} 号指认 ${accusedSeatView.seat + 1} 号（${accusedRole}）→ ${isHit ? '命中' : '未命中'}`;
  const successCount = viewModel.questResults.filter((result) => result === 'success').length;
  const failCount = viewModel.questResults.filter((result) => result === 'fail').length;
  const questSizes = isAvalonPlayerCount(viewModel.playerCount)
    ? AVALON_QUEST_SIZES[viewModel.playerCount].join(' / ')
    : null;
  const boardSections = createAvalonBoardInfoSections(viewModel.playerCount);
  const rounds = viewModel.roundHistory;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>阿瓦隆 · 本局复盘</Text>
            <Text
              style={styles.summary}
              accessibilityLabel={`成功 ${successCount} · 失败 ${failCount}`}
            >
              成功 <Text style={styles.summarySuccess}>{successCount}</Text> · 失败{' '}
              <Text style={styles.summaryFail}>{failCount}</Text>
            </Text>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[styles.banner, isGoodWin ? styles.bannerGood : styles.bannerEvil]}
              testID="avalon-review-conclusion"
            >
              <Text style={styles.bannerTitle}>{copy.title}</Text>
              <Text style={styles.bannerDescription}>{copy.description}</Text>
              {assassinLine !== null ? (
                <Text style={styles.bannerDescription}>{assassinLine}</Text>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>全员身份</Text>
            <View style={styles.card} testID="avalon-review-identities">
              {viewModel.seats.map((seatView) => (
                <View
                  key={seatView.seat}
                  style={styles.identityRow}
                  testID={`avalon-review-identity-${seatView.seat}`}
                >
                  <View style={styles.identityLeft}>
                    <SeatDot seat={seatView.seat} size="sm" />
                    <Text style={styles.identitySeat}>{seatView.seat + 1} 号</Text>
                    <Text style={styles.identityName}>{seatView.displayName}</Text>
                  </View>
                  <Text style={styles.identityRole}>
                    {seatView.role === null
                      ? '未知'
                      : `${getAvalonRoleDisplayName(seatView.role)}（${getAvalonFactionDisplayName(seatView.role)}）`}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>本局配置</Text>
            <View style={styles.card} testID="avalon-review-config">
              <Text style={styles.configLine}>
                投票{viewModel.voteMode === 'public' ? '公投' : '暗投'} · 否决上限{' '}
                {viewModel.vetoLimit}
                {questSizes !== null ? ` · 任务人数 ${questSizes}` : ''}
              </Text>
              <Text style={styles.configLine}>
                湖仙{viewModel.playerCount >= AVALON_LADY_MIN_PLAYERS ? '启用' : '不启用'}
              </Text>
              {boardSections === null
                ? null
                : boardSections.map((section) => (
                    <View key={section.title} style={styles.roleGroup}>
                      <Text style={[styles.roleGroupTitle, { color: section.color }]}>
                        {section.title}
                      </Text>
                      <View style={styles.roleItems}>
                        {section.items.map((item) => (
                          <Text key={item.roleId} style={styles.roleItem}>
                            {item.displayName}
                            {item.count > 1 ? ` ×${item.count}` : ''}
                          </Text>
                        ))}
                      </View>
                    </View>
                  ))}
            </View>

            <Text style={styles.sectionTitle}>湖仙查验</Text>
            <View style={styles.lakeList} testID="avalon-review-lake">
              {AVALON_LADY_ROUNDS.map((round) => (
                <AvalonRecordLakeSection
                  key={round}
                  afterRound={round}
                  record={rounds.find((record) => record.round === round) ?? null}
                  completed={
                    viewModel.ladyHistory.find((record) => record.afterRound === round) ?? null
                  }
                  inProgressHolderSeat={null}
                  ended
                  testIDPrefix={`avalon-review-lake-${round}`}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>任务进程</Text>
            <AvalonRecordTrack
              rounds={rounds}
              questResults={viewModel.questResults}
              currentRound={undefined}
              activeRound={undefined}
              ended
              testIDPrefix="avalon-review-track"
            />
            <View style={styles.roundList}>
              {rounds.map((record) => (
                <AvalonRecordRound
                  key={record.round}
                  record={record}
                  completedLadyCheck={
                    viewModel.ladyHistory.find((item) => item.afterRound === record.round) ?? null
                  }
                  inProgressLadyHolderSeat={null}
                  ended
                  testIDPrefix="avalon-review"
                />
              ))}
            </View>
          </ScrollView>
          <Button variant="secondary" size="lg" onPress={onClose} testID="avalon-review-close">
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
    maxHeight: '90%',
    gap: spacing.small,
    padding: spacing.medium,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xlarge,
    borderTopRightRadius: borderRadius.xlarge,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  title: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  },
  summary: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  summarySuccess: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  summaryFail: {
    color: colors.error,
    fontWeight: typography.weights.bold,
  },
  scroll: {
    minHeight: 0,
  },
  scrollContent: {
    gap: spacing.small,
    paddingBottom: spacing.small,
  },
  banner: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.large,
  },
  bannerGood: {
    backgroundColor: colors.success,
  },
  bannerEvil: {
    backgroundColor: colors.error,
  },
  bannerTitle: {
    ...textStyles.headingBold,
    color: colors.textInverse,
  },
  bannerDescription: {
    ...textStyles.secondary,
    color: colors.textInverse,
  },
  sectionTitle: {
    ...textStyles.caption,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
    letterSpacing: typography.letterSpacing.wide,
    marginTop: spacing.tight,
    paddingHorizontal: spacing.tight,
  },
  card: {
    gap: spacing.tight,
    padding: spacing.small,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  identityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    flexShrink: 1,
  },
  identitySeat: {
    ...textStyles.secondary,
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  identityName: {
    ...textStyles.secondary,
    color: colors.text,
  },
  identityRole: {
    ...textStyles.secondary,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  configLine: {
    ...textStyles.secondary,
    color: colors.text,
  },
  roleGroup: {
    gap: spacing.micro,
  },
  roleGroupTitle: {
    ...textStyles.caption,
    fontWeight: typography.weights.semibold,
  },
  roleItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  roleItem: {
    ...textStyles.secondary,
    color: colors.text,
  },
  lakeList: {
    gap: spacing.small,
  },
  roundList: {
    gap: spacing.small,
  },
});
