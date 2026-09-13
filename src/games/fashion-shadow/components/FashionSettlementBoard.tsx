/** Post-game identity and personal-objective reveal for the sealed case. */

import {
  FASHION_PLAYER_COUNT,
  FASHION_ROLE_BY_ID,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

import { useFashionCompactLayout } from './useFashionCompactLayout';

const SETTLEMENT_ENTRY_DURATION_MS = 260;

interface FashionSettlementBoardProps {
  readonly state: FashionPublicState;
  readonly mySeat: number | null;
}

export const FashionSettlementBoard: React.FC<FashionSettlementBoardProps> = ({
  state,
  mySeat,
}) => {
  const compactLayout = useFashionCompactLayout();
  const accusedRoleId =
    state.finalAccusedSeat === null ? undefined : state.revealedRoles[state.finalAccusedSeat];
  const accusedOccupant =
    state.finalAccusedSeat === null ? undefined : state.realSeats[state.finalAccusedSeat];
  const voteTally = Object.entries(state.finalVoteTally)
    .map(([seat, votes]) => ({ seat: Number(seat), votes }))
    .sort((left, right) => right.votes - left.votes || left.seat - right.seat);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.verdict,
          state.villainConvicted === true ? styles.verdictConvicted : styles.verdictNotConvicted,
        ]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          state.villainConvicted === true ? '最终裁决：反派被定罪' : '最终裁决：未形成反派定罪'
        }
      >
        <Text style={styles.verdictKicker}>FINAL VERDICT / 最终裁决</Text>
        <Text style={styles.verdictTitle}>
          {state.villainConvicted === true ? '反派被定罪' : '未形成反派定罪'}
        </Text>
        <Text style={styles.verdictBody}>
          {state.finalAccusedSeat === null
            ? '最终指控出现并列，没有唯一最高票被指认者。'
            : `最终最高票：${state.finalAccusedSeat + 1}号 ${accusedOccupant?.profile.displayName ?? ''} · ${accusedRoleId === undefined ? '身份未解析' : FASHION_ROLE_BY_ID[accusedRoleId].name}`}
        </Text>
        <View style={styles.tallyRow}>
          {voteTally.map(({ seat, votes }) => {
            const occupant = state.realSeats[seat];
            return (
              <View
                key={seat}
                style={[styles.tallyCell, compactLayout ? styles.tallyCellCompact : null]}
              >
                <Text style={styles.tallySeat}>
                  {seat + 1}号{occupant === undefined ? '' : ` · ${occupant.profile.displayName}`}
                </Text>
                <Text style={styles.tallyVotes}>{votes} 票</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.verdictRule}>
          定罪条件：至少 2 张公开证据，并且最终唯一最高票被指认者必须是反派。
        </Text>
      </View>

      <View style={[styles.headingRow, compactLayout ? styles.headingRowCompact : null]}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>IDENTITY DECLASSIFIED</Text>
          <Text style={styles.title}>全员身份与个人目标</Text>
        </View>
        <Text style={styles.count}>{state.winners.length} 胜</Text>
      </View>

      <View style={styles.rows}>
        {Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => {
          const roleId = state.revealedRoles[seat];
          const occupant = state.realSeats[seat];
          if (roleId === undefined || occupant === undefined) return null;
          const role = FASHION_ROLE_BY_ID[roleId];
          const didWin = state.winners.includes(seat);
          const isSelf = seat === mySeat;
          return (
            <Animated.View
              key={seat}
              entering={FadeIn.duration(SETTLEMENT_ENTRY_DURATION_MS).reduceMotion(
                ReduceMotion.System,
              )}
              style={[
                styles.row,
                didWin ? styles.rowWinner : styles.rowLost,
                isSelf ? styles.rowSelf : null,
              ]}
            >
              <View
                style={[styles.identityLine, compactLayout ? styles.identityLineCompact : null]}
              >
                <View style={styles.identityCopy}>
                  <Text style={styles.seatLabel}>
                    {seat + 1}号 · {occupant.profile.displayName}
                    {isSelf ? ' · 你' : ''}
                  </Text>
                  <Text style={styles.roleName}>{role.name}</Text>
                </View>
                <View
                  style={[
                    styles.resultBadge,
                    compactLayout ? styles.resultBadgeCompact : null,
                    didWin ? styles.resultBadgeWin : styles.resultBadgeLost,
                  ]}
                >
                  <Text
                    style={[
                      styles.resultText,
                      didWin ? styles.resultTextWin : styles.resultTextLost,
                    ]}
                  >
                    {didWin ? '达成' : '未达成'}
                  </Text>
                </View>
              </View>
              <Text style={styles.label}>隐藏秘密</Text>
              <Text style={styles.body}>{role.secret}</Text>
              <Text style={styles.label}>个人胜利条件</Text>
              <Text style={styles.body}>{role.victoryCondition}</Text>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.medium },
  verdict: {
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    padding: spacing.large,
    gap: spacing.small,
    backgroundColor: fashionShadowColors.surfaceMuted,
  },
  verdictConvicted: { borderColor: fashionShadowColors.neonPink },
  verdictNotConvicted: { borderColor: fashionShadowColors.neonCyan },
  verdictKicker: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  verdictTitle: {
    color: fashionShadowColors.text,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  verdictBody: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  tallyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  tallyCell: {
    maxWidth: '100%',
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surface,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    flexDirection: 'row',
    gap: spacing.tight,
  },
  tallyCellCompact: { width: '100%', justifyContent: 'space-between' },
  tallySeat: {
    flexShrink: 1,
    color: fashionShadowColors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  tallyVotes: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  verdictRule: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  headingRowCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  headingCopy: { flex: 1, gap: spacing.micro },
  eyebrow: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  title: {
    color: fashionShadowColors.text,
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
  },
  count: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
  },
  rows: { gap: spacing.small },
  row: {
    borderRadius: borderRadius.large,
    borderWidth: fixed.borderWidth,
    padding: spacing.medium,
    gap: spacing.small,
    backgroundColor: fashionShadowColors.surfaceMuted,
  },
  rowWinner: { borderColor: fashionShadowColors.success },
  rowLost: { borderColor: fashionShadowColors.border },
  rowSelf: { borderColor: fashionShadowColors.neonCyan },
  identityLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  identityLineCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  identityCopy: { flex: 1, gap: spacing.micro },
  seatLabel: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  roleName: {
    color: fashionShadowColors.text,
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
  },
  resultBadge: {
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  resultBadgeCompact: { alignSelf: 'flex-start' },
  resultBadgeWin: {
    borderColor: fashionShadowColors.success,
    backgroundColor: fashionShadowColors.successSoft,
  },
  resultBadgeLost: {
    borderColor: fashionShadowColors.danger,
    backgroundColor: fashionShadowColors.dangerSoft,
  },
  resultText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  resultTextWin: { color: fashionShadowColors.success },
  resultTextLost: { color: fashionShadowColors.danger },
  label: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  body: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
});
