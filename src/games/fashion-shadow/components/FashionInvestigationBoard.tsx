/** FashionInvestigationBoard — public relationship board built only from revealed case state. */
import {
  FASHION_PLAYER_COUNT,
  FASHION_ROLE_BY_ID,
  FASHION_ROUND_BY_NUMBER,
  type FashionEvidenceId,
  type FashionPublicState,
  type FashionRoleId,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

import { useFashionCompactLayout } from './useFashionCompactLayout';

interface FashionInvestigationBoardProps {
  readonly state: FashionPublicState;
  readonly mySeat: number | null;
}

function roleForRevealedSecret(
  secretId: FashionPublicState['revealedSecrets'][number],
): FashionRoleId {
  const role = Object.values(FASHION_ROLE_BY_ID).find((entry) => entry.secretId === secretId);
  if (role === undefined) {
    throw new Error(`[FAIL-FAST] Unknown Fashion Shadow secret ${secretId}`);
  }
  return role.id;
}

function evidenceStatus(
  state: FashionPublicState,
  evidenceId: FashionEvidenceId,
): 'public' | 'destroyed' | 'current' {
  if (state.publicEvidence.includes(evidenceId)) return 'public';
  if (state.destroyedEvidence.includes(evidenceId)) return 'destroyed';
  return 'current';
}

const STATUS_LABELS = {
  public: '已采信',
  destroyed: '已销毁',
  current: '调查中',
} as const;

export const FashionInvestigationBoard: React.FC<FashionInvestigationBoardProps> = ({
  state,
  mySeat,
}) => {
  const compactLayout = useFashionCompactLayout();
  const visibleRounds = useMemo(
    () =>
      ([1, 2, 3, 4] as const).filter(
        (roundNumber) => roundNumber <= state.currentRound || state.phase === 'ended',
      ),
    [state.currentRound, state.phase],
  );

  const publicRoleBySeat = useMemo(() => {
    const result: Record<number, FashionRoleId> = { ...state.revealedRoles };
    for (const [rawSeat, secretId] of Object.entries(state.revealedSecrets)) {
      result[Number(rawSeat)] = roleForRevealedSecret(secretId);
    }
    return result;
  }, [state.revealedRoles, state.revealedSecrets]);

  return (
    <View style={styles.container}>
      <View style={[styles.headingRow, compactLayout ? styles.headingRowCompact : null]}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>INVESTIGATION BOARD</Text>
          <Text style={styles.title}>调查关系板</Text>
        </View>
        <Text style={styles.meta}>
          质询 {state.crossExamStatements.length} · 讨论 {state.discussionMessages.length}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>人物节点</Text>
        <View style={styles.personGrid}>
          {Array.from({ length: FASHION_PLAYER_COUNT }, (_, seat) => {
            const occupant = state.realSeats[seat];
            if (occupant === undefined) return null;
            const roleId = publicRoleBySeat[seat];
            const statements = state.crossExamStatements.filter((entry) => entry.seat === seat);
            const discussionCount = state.discussionMessages.filter(
              (entry) => entry.seat === seat,
            ).length;
            const awards = state.crossExamAwards.filter((entry) => entry.seat === seat).length;
            const citedEvidence = [
              ...new Set(
                statements
                  .map((entry) => entry.evidenceId)
                  .filter((evidenceId): evidenceId is FashionEvidenceId => evidenceId !== null),
              ),
            ];
            return (
              <View
                key={seat}
                style={[
                  styles.personCard,
                  compactLayout ? styles.personCardCompact : null,
                  seat === mySeat ? styles.selfCard : null,
                ]}
              >
                <Text style={styles.personTitle}>
                  {seat + 1}号 · {occupant.profile.displayName}
                </Text>
                {roleId !== undefined ? (
                  <Text style={styles.publicRole}>
                    公开身份关联 · {FASHION_ROLE_BY_ID[roleId].name}
                  </Text>
                ) : (
                  <Text style={styles.muted}>身份仍隐藏</Text>
                )}
                <View style={styles.tagRow}>
                  {statements.length > 0 ? (
                    <Text style={styles.tag}>质询 {statements.length}</Text>
                  ) : null}
                  {discussionCount > 0 ? (
                    <Text style={styles.tag}>讨论 {discussionCount}</Text>
                  ) : null}
                  {awards > 0 ? <Text style={styles.tag}>最佳攻防 ×{awards}</Text> : null}
                  {citedEvidence.map((evidenceId) => (
                    <Text key={evidenceId} style={styles.tag}>
                      引用 {evidenceId}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>证据节点</Text>
        {visibleRounds.map((roundNumber) => {
          const round = FASHION_ROUND_BY_NUMBER[roundNumber];
          const status = evidenceStatus(state, round.evidenceId);
          const citedSeats = [
            ...new Set(
              state.crossExamStatements
                .filter((entry) => entry.evidenceId === round.evidenceId)
                .map((entry) => entry.seat),
            ),
          ].sort((left, right) => left - right);
          const publicImplications =
            status === 'public'
              ? round.implicatedRoles.map((roleId) => FASHION_ROLE_BY_ID[roleId].name)
              : [];
          return (
            <View
              key={round.evidenceId}
              style={[styles.evidenceRow, compactLayout ? styles.evidenceRowCompact : null]}
            >
              <View style={styles.evidenceCopy}>
                <Text style={styles.evidenceTitle}>
                  {round.evidenceId} · {round.evidenceTitle}
                </Text>
                <Text style={styles.muted}>
                  {round.location} · {round.esg}
                </Text>
                {citedSeats.length > 0 ? (
                  <Text style={styles.relationText}>
                    被 {citedSeats.map((seat) => `${seat + 1}号`).join('、')} 在质询中引用
                  </Text>
                ) : null}
                {publicImplications.length > 0 ? (
                  <Text style={styles.implicationText}>
                    证据内容直接关联：{publicImplications.join('、')}
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  status === 'public'
                    ? styles.statusPublic
                    : status === 'destroyed'
                      ? styles.statusDestroyed
                      : styles.statusCurrent,
                ]}
              >
                <Text style={styles.statusText}>{STATUS_LABELS[status]}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {state.phase === 'ended' && state.finalAccusedSeat !== null ? (
        <View style={styles.verdictLink}>
          <Text style={styles.verdictLabel}>最终关系</Text>
          <Text style={styles.verdictText}>
            全局最高票指向 {state.finalAccusedSeat + 1}号 ·
            {state.villainConvicted === true ? ' 证据链与身份共同形成定罪' : ' 未形成反派定罪'}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.medium },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.medium,
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
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
  },
  meta: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  section: { gap: spacing.small },
  sectionTitle: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
  },
  personGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  personCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: '46%',
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surface,
    padding: spacing.medium,
    gap: spacing.tight,
  },
  personCardCompact: { flexBasis: '100%', minWidth: '100%' },
  selfCard: {
    borderColor: fashionShadowColors.neonCyan,
    backgroundColor: fashionShadowColors.neonCyanSoft,
  },
  personTitle: {
    color: fashionShadowColors.text,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
  },
  publicRole: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  muted: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.tight },
  tag: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonCyanSoft,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surfaceRaised,
    padding: spacing.medium,
  },
  evidenceRowCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  evidenceCopy: { flex: 1, gap: spacing.micro },
  evidenceTitle: {
    color: fashionShadowColors.text,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
  },
  relationText: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  implicationText: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  statusBadge: {
    borderWidth: fixed.borderWidth,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  statusPublic: {
    borderColor: fashionShadowColors.success,
    backgroundColor: fashionShadowColors.successSoft,
  },
  statusDestroyed: {
    borderColor: fashionShadowColors.danger,
    backgroundColor: fashionShadowColors.dangerSoft,
  },
  statusCurrent: {
    borderColor: fashionShadowColors.neonCyan,
    backgroundColor: fashionShadowColors.neonCyanSoft,
  },
  statusText: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.bold,
  },
  verdictLink: {
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonPink,
    backgroundColor: fashionShadowColors.neonPinkSoft,
    padding: spacing.medium,
    gap: spacing.tight,
  },
  verdictLabel: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  verdictText: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
});
