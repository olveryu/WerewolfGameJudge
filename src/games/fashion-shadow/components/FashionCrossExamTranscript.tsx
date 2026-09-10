/** Public cross-examination transcript with optional evidence citations. */

import {
  FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH,
  FASHION_MAX_CROSS_EXAM_STATEMENTS_PER_MATCH,
  FASHION_ROUND_BY_NUMBER,
  type FashionEvidenceId,
  type FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

import { FashionButton as Button } from './FashionButton';

type TranscriptMode = 'live' | 'archive';

interface FashionCrossExamTranscriptProps {
  readonly state: FashionPublicState;
  readonly mySeat: number | null;
  readonly isSubmitting?: boolean;
  readonly remainingMs?: number;
  readonly mode?: TranscriptMode;
  readonly onSend?: (message: string, evidenceId?: FashionEvidenceId) => Promise<boolean>;
}

function getEvidenceDefinition(evidenceId: FashionEvidenceId) {
  return ([1, 2, 3, 4] as const)
    .map((roundNumber) => FASHION_ROUND_BY_NUMBER[roundNumber])
    .find((round) => round.evidenceId === evidenceId);
}

export const FashionCrossExamTranscript: React.FC<FashionCrossExamTranscriptProps> = ({
  state,
  mySeat,
  isSubmitting = false,
  remainingMs = 0,
  mode = 'archive',
  onSend,
}) => {
  const [draft, setDraft] = useState('');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<FashionEvidenceId | null>(null);
  const interrogation = state.interrogation;
  const liveStatements = useMemo(
    () =>
      interrogation === null
        ? []
        : state.crossExamStatements.filter(
            (statement) =>
              statement.round === state.currentRound && statement.match === interrogation.match,
          ),
    [interrogation, state.crossExamStatements, state.currentRound],
  );
  const statements = mode === 'live' ? liveStatements : state.crossExamStatements;
  const activeSide =
    interrogation === null || mySeat === null
      ? null
      : mySeat === interrogation.attackerSeat
        ? 'attacker'
        : mySeat === interrogation.defenderSeat
          ? 'defender'
          : null;
  const myStatementCount =
    mode === 'live' && mySeat !== null
      ? liveStatements.filter((statement) => statement.seat === mySeat).length
      : 0;
  const remainingStatements = Math.max(
    0,
    FASHION_MAX_CROSS_EXAM_STATEMENTS_PER_MATCH - myStatementCount,
  );
  const currentEvidenceId = FASHION_ROUND_BY_NUMBER[state.currentRound].evidenceId;
  const availableEvidence = useMemo(
    () => Array.from(new Set<FashionEvidenceId>([...state.publicEvidence, currentEvidenceId])),
    [currentEvidenceId, state.publicEvidence],
  );
  const trimmedDraft = draft.trim();
  const canSend =
    mode === 'live' &&
    onSend !== undefined &&
    activeSide !== null &&
    remainingStatements > 0 &&
    remainingMs > 0 &&
    trimmedDraft.length > 0 &&
    !isSubmitting;

  const handleSend = async () => {
    if (!canSend || onSend === undefined) return;
    const accepted = await onSend(trimmedDraft, selectedEvidenceId ?? undefined);
    if (accepted) {
      setDraft('');
      setSelectedEvidenceId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>
            {mode === 'live' ? 'LIVE TRANSCRIPT' : 'CROSS-EXAM ARCHIVE'}
          </Text>
          <Text style={styles.heading}>{mode === 'live' ? '本组质询记录' : '交叉质询回放'}</Text>
        </View>
        <Text style={styles.counter}>{statements.length} 条</Text>
      </View>

      {statements.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {mode === 'live'
              ? '当前还没有正式论点。攻防双方提交的内容会实时进入全员案件记录。'
              : '暂无交叉质询记录。'}
          </Text>
        </View>
      ) : (
        <View style={styles.statements}>
          {statements.map((statement, index) => {
            const occupant = state.realSeats[statement.seat];
            const evidence =
              statement.evidenceId === null
                ? undefined
                : getEvidenceDefinition(statement.evidenceId);
            const isSelf = statement.seat === mySeat;
            return (
              <View
                key={`${statement.round}:${statement.match}:${statement.seat}:${statement.createdAt}:${index}`}
                style={[
                  styles.statement,
                  statement.side === 'attacker' ? styles.attackStatement : styles.defendStatement,
                  isSelf ? styles.selfStatement : null,
                ]}
              >
                <View style={styles.statementTopRow}>
                  <Text
                    style={[
                      styles.statementMeta,
                      statement.side === 'attacker' ? styles.attackText : styles.defendText,
                    ]}
                  >
                    R{statement.round} · 第{statement.match}组 ·{' '}
                    {statement.side === 'attacker' ? '攻击' : '防守'}
                  </Text>
                  <Text style={styles.seatText}>
                    {statement.seat + 1}号 · {occupant?.profile.displayName ?? '未知玩家'}
                  </Text>
                </View>
                <Text style={styles.statementText}>{statement.message}</Text>
                {statement.evidenceId !== null ? (
                  <View style={styles.citation}>
                    <Text style={styles.citationLabel}>引用证据</Text>
                    <Text style={styles.citationText}>
                      {statement.evidenceId} · {evidence?.evidenceTitle ?? '案件证据'}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {mode === 'live' ? (
        activeSide === null ? (
          <Text style={styles.hint}>
            你当前是旁听陪审团；可以查看双方论点，但不能代替攻防者发言。
          </Text>
        ) : (
          <View style={styles.composer}>
            <View style={styles.roleStrip}>
              <Text style={activeSide === 'attacker' ? styles.attackText : styles.defendText}>
                你的席位：{activeSide === 'attacker' ? '攻击方' : '防守方'}
              </Text>
              <Text style={styles.hint}>本组还可提交 {remainingStatements} 条正式论点</Text>
            </View>
            <Text style={styles.evidenceLabel}>可选证据引用</Text>
            <View style={styles.evidenceChoices}>
              <View style={styles.choiceCell}>
                <Button
                  variant={selectedEvidenceId === null ? 'primary' : 'secondary'}
                  size="sm"
                  onPress={() => setSelectedEvidenceId(null)}
                >
                  不引用
                </Button>
              </View>
              {availableEvidence.map((evidenceId) => {
                const evidence = getEvidenceDefinition(evidenceId);
                const suffix = evidenceId === currentEvidenceId ? '本轮' : '公开';
                return (
                  <View key={evidenceId} style={styles.choiceCell}>
                    <Button
                      variant={selectedEvidenceId === evidenceId ? 'primary' : 'secondary'}
                      size="sm"
                      onPress={() => setSelectedEvidenceId(evidenceId)}
                    >
                      {evidenceId} · {suffix}
                      {evidence === undefined ? '' : ` · ${evidence.location}`}
                    </Button>
                  </View>
                );
              })}
            </View>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="写下本次攻击或回应，可引用上面的案件证据…"
              placeholderTextColor={fashionShadowColors.textMuted}
              maxLength={FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH}
              multiline
              editable={!isSubmitting && remainingStatements > 0 && remainingMs > 0}
              style={styles.input}
              accessibilityLabel="交叉质询正式论点"
            />
            <View style={styles.composerFooter}>
              <Text style={styles.hint}>
                {draft.length}/{FASHION_CROSS_EXAM_STATEMENT_MAX_LENGTH} · 提交论点不额外扣行动代币
              </Text>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => void handleSend()}
                disabled={!canSend}
                loading={isSubmitting}
              >
                记录论点
              </Button>
            </View>
          </View>
        )
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.small },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  headingCopy: { flex: 1, gap: spacing.micro },
  eyebrow: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.bold,
  },
  heading: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
  },
  counter: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  statements: { gap: spacing.small },
  statement: {
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    padding: spacing.medium,
    gap: spacing.small,
    backgroundColor: fashionShadowColors.surface,
  },
  attackStatement: { borderColor: fashionShadowColors.neonPinkSoft },
  defendStatement: { borderColor: fashionShadowColors.neonCyanSoft },
  selfStatement: { backgroundColor: fashionShadowColors.surfaceRaised },
  statementTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  statementMeta: {
    flex: 1,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  attackText: { color: fashionShadowColors.neonPink },
  defendText: { color: fashionShadowColors.neonCyan },
  seatText: {
    flexShrink: 1,
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    textAlign: 'right',
  },
  statementText: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  citation: {
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonCyanSoft,
    backgroundColor: fashionShadowColors.neonCyanSoft,
    padding: spacing.small,
    gap: spacing.micro,
  },
  citationLabel: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.bold,
  },
  citationText: {
    color: fashionShadowColors.text,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  emptyState: {
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    padding: spacing.medium,
    backgroundColor: fashionShadowColors.surface,
  },
  emptyText: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
  composer: {
    borderTopWidth: fixed.borderWidth,
    borderTopColor: fashionShadowColors.border,
    paddingTop: spacing.medium,
    gap: spacing.small,
  },
  roleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  evidenceLabel: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
  evidenceChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  choiceCell: { flexGrow: 1 },
  input: {
    color: fashionShadowColors.text,
    backgroundColor: fashionShadowColors.surfaceRaised,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.neonPinkSoft,
    padding: spacing.medium,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    minHeight: spacing.xxlarge,
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  hint: {
    flex: 1,
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
});
