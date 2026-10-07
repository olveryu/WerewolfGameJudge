/**
 * 阿瓦隆终局：胜负横幅 + 获胜原因 + 全员身份揭晓。
 */

import { type AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing, textStyles } from '@/theme';

import {
  getAvalonFactionDisplayName,
  getAvalonRoleDisplayName,
} from '../../model/avalonRoleDisplay';
import { AVALON_END_REASON_COPY, resolveEndedInstruction } from '../policy/avalonInteractionPolicy';
import { AvalonInfoCard, AvalonStageFrame } from './AvalonStageFrame';

/** 终局视图：只渲染权威结算数据。 */
export function AvalonEndedView({ viewModel }: { readonly viewModel: AvalonViewModel }) {
  const instruction = resolveEndedInstruction(viewModel);
  const copy = AVALON_END_REASON_COPY[instruction.reason];
  const isGoodWin = instruction.winner === 'good';
  const accusedName =
    instruction.accusedSeat === null
      ? null
      : (viewModel.seats.find((seatView) => seatView.seat === instruction.accusedSeat)
          ?.displayName ?? `座位${instruction.accusedSeat + 1}`);
  return (
    <AvalonStageFrame title="本局结束" testID="avalon-ended">
      <View style={[styles.banner, isGoodWin ? styles.bannerGood : styles.bannerEvil]}>
        <Text style={styles.bannerTitle}>{copy.title}</Text>
        <Text style={styles.bannerDescription}>{copy.description}</Text>
        {accusedName !== null ? (
          <Text style={styles.bannerDescription}>刺客指认了【{accusedName}】</Text>
        ) : null}
      </View>
      <AvalonInfoCard title="身份揭晓">
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
      </AvalonInfoCard>
      <Text style={styles.hint}>等待房主操作（再来一局 / 返回大厅）。</Text>
    </AvalonStageFrame>
  );
}

const styles = StyleSheet.create({
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
  hint: {
    ...textStyles.secondary,
    color: colors.textSecondary,
  },
});
