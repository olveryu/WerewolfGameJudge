/**
 * 阿瓦隆终局结算区：胜负横幅 + 获胜原因 + 全员身份揭晓。
 * 常驻在座位表上方（终局是全员停留的终态，结算必须常驻可见，
 * 不做成可关闭浮层）。
 */

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing, textStyles } from '@/theme';

import {
  getAvalonFactionDisplayName,
  getAvalonRoleDisplayName,
} from '../../model/avalonRoleDisplay';
import { AVALON_END_REASON_COPY, resolveEndedInstruction } from '../policy/avalonInteractionPolicy';

/** 结算区最大宽度（与原阶段层一致），水平居中。 */
const ENDED_SECTION_MAX_WIDTH = 430;

/** 终局结算区：只渲染权威结算数据。 */
export function AvalonEndedSection({ viewModel }: { readonly viewModel: AvalonViewModel }) {
  const instruction = resolveEndedInstruction(viewModel);
  const copy = AVALON_END_REASON_COPY[instruction.reason];
  const isGoodWin = instruction.winner === 'good';
  const accusedName =
    instruction.accusedSeat === null
      ? null
      : (viewModel.seats.find((seatView) => seatView.seat === instruction.accusedSeat)
          ?.displayName ?? `座位${instruction.accusedSeat + 1}`);
  return (
    <View style={styles.section} testID="avalon-ended">
      <View style={[styles.banner, isGoodWin ? styles.bannerGood : styles.bannerEvil]}>
        <Text style={styles.bannerTitle}>{copy.title}</Text>
        <Text style={styles.bannerDescription}>{copy.description}</Text>
        {accusedName !== null ? (
          <Text style={styles.bannerDescription}>刺客指认了【{accusedName}】</Text>
        ) : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>身份揭晓</Text>
        {viewModel.seats.map((seatView) => (
          <Text
            key={seatView.seat}
            style={styles.roleRow}
            testID={`avalon-ended-role-${seatView.seat}`}
          >
            {seatView.seat + 1} 号 · {seatView.displayName} ·{' '}
            {seatView.role === null
              ? '未知'
              : `${getAvalonRoleDisplayName(seatView.role)}（${getAvalonFactionDisplayName(seatView.role)}）`}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    maxWidth: ENDED_SECTION_MAX_WIDTH,
    alignSelf: 'center',
    gap: spacing.small,
    paddingHorizontal: spacing.screenH,
    paddingVertical: spacing.small,
  },
  card: {
    width: '100%',
    gap: spacing.small,
    padding: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
  },
  cardTitle: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
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
  roleRow: {
    ...textStyles.body,
    color: colors.text,
  },
});
