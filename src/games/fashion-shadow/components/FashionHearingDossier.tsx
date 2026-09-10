/** Final-hearing case dossier assembled from the four completed investigation rounds. */

import {
  FASHION_ROUND_BY_NUMBER,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

import { useFashionCompactLayout } from './useFashionCompactLayout';

const HEARING_EVIDENCE_THRESHOLD = 2;

interface FashionHearingDossierProps {
  readonly state: FashionPublicState;
}

export const FashionHearingDossier: React.FC<FashionHearingDossierProps> = ({ state }) => {
  const compactLayout = useFashionCompactLayout();

  return (
    <View style={styles.container}>
      <View style={[styles.summaryRow, compactLayout ? styles.summaryRowCompact : null]}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryValue}>{state.publicEvidence.length}</Text>
          <Text style={styles.summaryLabel}>公开证据</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryValue}>{HEARING_EVIDENCE_THRESHOLD}</Text>
          <Text style={styles.summaryLabel}>定罪最低证据</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryValue}>
            {state.crossExamStatements.length}/{state.discussionMessages.length}
          </Text>
          <Text style={styles.summaryLabel}>质询/讨论论点</Text>
        </View>
      </View>

      <View style={styles.rounds}>
        {([1, 2, 3, 4] as const).map((roundNumber) => {
          const round = FASHION_ROUND_BY_NUMBER[roundNumber];
          const isPublic = state.publicEvidence.includes(round.evidenceId);
          const isDestroyed = state.destroyedEvidence.includes(round.evidenceId);
          const discussionCount = state.discussionMessages.filter(
            (message) => message.round === roundNumber,
          ).length;
          const crossExamCount = state.crossExamStatements.filter(
            (statement) => statement.round === roundNumber,
          ).length;
          return (
            <View
              key={roundNumber}
              style={[styles.roundRow, compactLayout ? styles.roundRowCompact : null]}
            >
              <View style={styles.roundCopy}>
                <Text style={styles.roundTitle}>
                  R{roundNumber} · {round.location} · {round.esg}
                </Text>
                <Text style={styles.roundEvidence}>
                  {round.evidenceId} · {round.evidenceTitle}
                </Text>
                <Text style={styles.roundMeta}>
                  质询 {crossExamCount} 条 · 公开讨论 {discussionCount} 条
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  isPublic ? styles.statusPublic : isDestroyed ? styles.statusDestroyed : null,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isPublic
                      ? styles.statusTextPublic
                      : isDestroyed
                        ? styles.statusTextDestroyed
                        : null,
                  ]}
                >
                  {isPublic ? '已采信' : isDestroyed ? '已销毁' : '未结算'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.medium },
  summaryRow: { flexDirection: 'row', gap: spacing.small },
  summaryRowCompact: { flexDirection: 'column' },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: fashionShadowColors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonPinkSoft,
    padding: spacing.small,
    gap: spacing.micro,
  },
  summaryValue: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  summaryLabel: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    textAlign: 'center',
  },
  rounds: { gap: spacing.small },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.medium,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surface,
  },
  roundRowCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  roundCopy: { flex: 1, gap: spacing.micro },
  roundTitle: {
    color: fashionShadowColors.text,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
  },
  roundEvidence: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  roundMeta: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
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
  statusText: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  statusTextPublic: { color: fashionShadowColors.success },
  statusTextDestroyed: { color: fashionShadowColors.danger },
});
