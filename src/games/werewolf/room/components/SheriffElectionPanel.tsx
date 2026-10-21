/**
 * Presentational sheriff-election panel.
 *
 * Renders the state-driven public record and reports user intent through the
 * supplied panel model. It does not derive eligibility or call services.
 * The record is drawn graphically first: seat dots for candidacy, tally bars
 * with voters grouped under their candidate, and a banner for the outcome.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { SheriffElectionResult } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import type React from 'react';
import { memo, useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
import type {
  SheriffElectionPanelModel,
  SheriffElectionPendingAction,
} from '@/games/werewolf/room/hooks/useSheriffElection';
import type {
  SheriffBallotSelectionViewModel,
  SheriffElectionRoundViewModel,
} from '@/games/werewolf/room/sheriffElectionViewModel';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import type { SheriffElectionPanelStyles } from './sheriffElectionPanel.styles';

interface SheriffElectionPanelProps {
  readonly model: SheriffElectionPanelModel;
  readonly styles: SheriffElectionPanelStyles;
}

interface BallotChoiceProps {
  readonly targetSeat: number | null;
  readonly isSelected: boolean;
  readonly pendingAction: SheriffElectionPendingAction | null;
  readonly onVote: (targetSeat: number | null) => Promise<void>;
  readonly testID: string;
  readonly styles: SheriffElectionPanelStyles;
}

const BallotChoice: React.FC<BallotChoiceProps> = memo(
  ({ targetSeat, isSelected, pendingAction, onVote, testID, styles }) => {
    const handlePress = useCallback(() => {
      void onVote(targetSeat);
    }, [onVote, targetSeat]);
    const isLoading = pendingAction?.kind === 'vote' && pendingAction.targetSeat === targetSeat;
    const isDisabled = pendingAction !== null;
    const label = targetSeat === null ? '弃票' : formatSeat(targetSeat);

    return (
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.ballotChoice,
          isSelected && styles.ballotChoiceSelected,
          pressed && !isDisabled && styles.ballotChoicePressed,
          isDisabled && !isLoading && styles.ballotChoiceDisabled,
        ]}
        testID={testID}
        accessibilityRole="radio"
        accessibilityLabel={targetSeat === null ? '弃票' : `投给${label}`}
        accessibilityState={{ disabled: isDisabled, checked: isSelected, busy: isLoading }}
        aria-checked={isSelected}
      >
        <View style={styles.ballotChoiceIndicator}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : isSelected ? (
            <Ionicons
              name="checkmark-circle"
              size={componentSizes.icon.sm}
              color={colors.primary}
            />
          ) : null}
        </View>
        <Text style={[styles.ballotChoiceText, isSelected && styles.ballotChoiceTextSelected]}>
          {label}
        </Text>
      </Pressable>
    );
  },
);
BallotChoice.displayName = 'SheriffBallotChoice';

function areSameSeats(first: readonly number[], second: readonly number[]): boolean {
  return first.length === second.length && first.every((seat, index) => seat === second[index]);
}

function getMyBallotText(selection: SheriffBallotSelectionViewModel | null): string | null {
  if (selection === null) return null;
  switch (selection.kind) {
    case 'notSubmitted':
      return '尚未投票';
    case 'abstained':
      return '已选择弃票，可重新选择';
    case 'candidate':
      return `已投给 ${formatSeat(selection.seat)}，可重新选择`;
  }
}

function getNoSheriffText(result: Extract<SheriffElectionResult, { kind: 'noSheriff' }>): string {
  switch (result.reason) {
    case 'noCandidates':
      return '无人参选，本局没有警长';
    case 'noVotes':
      return '无人得票，本局没有警长';
    case 'runoffTie':
      return '平票未决，本局没有警长';
    case 'selfDestruct':
      return '因狼人自爆，警长竞选已结束且没有警长';
  }
}

interface ResultBannerProps {
  readonly result: SheriffElectionResult;
  readonly completedRounds: readonly SheriffElectionRoundViewModel[];
  readonly styles: SheriffElectionPanelStyles;
}

/** Outcome banner: gold medal block for an elected sheriff, neutral otherwise. */
function ResultBanner({ result, completedRounds, styles }: ResultBannerProps) {
  const isElected = result.kind === 'elected';
  let title: string;
  let subtitle: string | null = null;
  if (result.kind === 'elected') {
    title = `${formatSeat(result.sheriffSeat)} · 当选警长`;
    const decidingRound = completedRounds[completedRounds.length - 1];
    subtitle =
      decidingRound === undefined
        ? `警徽在 ${formatSeat(result.sheriffSeat)}`
        : `${decidingRound.key === 'first' ? '首轮' : '平票'}投票当选 · 警徽在 ${formatSeat(result.sheriffSeat)}`;
  } else {
    title = getNoSheriffText(result);
  }

  return (
    <View
      style={[styles.resultBanner, !isElected && styles.resultBannerNeutral]}
      testID={TESTIDS.sheriffElectionResult}
    >
      <View style={[styles.resultMedal, !isElected && styles.resultMedalNeutral]}>
        <Ionicons
          name={isElected ? 'shield-checkmark' : 'shield-outline'}
          size={componentSizes.icon.lg}
          color={isElected ? colors.textInverse : colors.textSecondary}
        />
      </View>
      <View style={styles.resultTextGroup}>
        <Text style={styles.resultTitle}>{title}</Text>
        {subtitle !== null && <Text style={styles.resultSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

interface CompletedRoundProps {
  readonly round: SheriffElectionRoundViewModel;
  readonly winnerSeat: number | null;
  readonly styles: SheriffElectionPanelStyles;
}

/**
 * One closed round as a tally card: a bar per candidate with that candidate's
 * voters grouped underneath, and abstentions demoted to one grey line.
 */
function CompletedRound({ round, winnerSeat, styles }: CompletedRoundProps) {
  const votersByCandidate = new Map<number, number[]>();
  const abstainVoters: number[] = [];
  for (const voterSeat of round.eligibleVoterSeats) {
    const targetSeat = round.ballots[voterSeat];
    if (targetSeat === undefined) {
      throw new Error(`[FAIL-FAST] Sheriff round view has no ballot for seat ${voterSeat}`);
    }
    if (targetSeat === null) {
      abstainVoters.push(voterSeat);
    } else {
      const voters = votersByCandidate.get(targetSeat);
      if (voters === undefined) votersByCandidate.set(targetSeat, [voterSeat]);
      else voters.push(voterSeat);
    }
  }
  for (const voters of votersByCandidate.values()) voters.sort((a, b) => a - b);
  abstainVoters.sort((a, b) => a - b);
  const totalVotes = round.candidateSeats.reduce((sum, seat) => {
    const voteCount = round.voteCounts[seat];
    if (voteCount === undefined) {
      throw new Error(`[FAIL-FAST] Sheriff round view has no count for seat ${seat}`);
    }
    return sum + voteCount;
  }, 0);

  return (
    <View style={styles.roundSection} testID={TESTIDS.sheriffCompletedRound(round.key)}>
      <Text style={styles.roundTitle}>{round.title}</Text>
      <View style={styles.tallyCard}>
        {round.candidateSeats.map((seat, index) => {
          const voteCount = round.voteCounts[seat];
          if (voteCount === undefined) {
            throw new Error(`[FAIL-FAST] Sheriff round view has no count for seat ${seat}`);
          }
          const isWinner = winnerSeat === seat;
          const voters = votersByCandidate.get(seat) ?? [];
          return (
            <View
              key={seat}
              style={[styles.tallyGroup, index > 0 && styles.tallyGroupBorder]}
              testID={TESTIDS.sheriffTallyGroup(round.key, seat)}
            >
              <View style={styles.tallyRow}>
                <Text style={[styles.tallyName, isWinner && styles.tallyNameWinner]}>
                  {formatSeat(seat)}
                </Text>
                {isWinner && (
                  <Ionicons name="trophy" size={componentSizes.icon.xs} color={colors.warning} />
                )}
                <View style={styles.tallyBarTrack}>
                  {voteCount > 0 && (
                    <View
                      style={[
                        styles.tallyBarFill,
                        isWinner && styles.tallyBarFillWinner,
                        { flexGrow: voteCount },
                      ]}
                    />
                  )}
                  {voteCount < totalVotes && <View style={{ flexGrow: totalVotes - voteCount }} />}
                </View>
                <Text style={styles.tallyCount}>{voteCount} 票</Text>
              </View>
              {voters.length > 0 && (
                <View style={styles.voterChips} accessibilityLabel={`${formatSeat(seat)}的投票人`}>
                  {voters.map((voterSeat) => (
                    <View
                      key={voterSeat}
                      style={styles.voterChip}
                      testID={TESTIDS.sheriffBallotChip(round.key, voterSeat)}
                    >
                      <SeatDot seat={voterSeat} size="sm" />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        {abstainVoters.length > 0 && (
          <View style={styles.abstainRow} testID={TESTIDS.sheriffAbstainRow(round.key)}>
            <Text style={styles.abstainLabel}>弃票</Text>
            {abstainVoters.map((voterSeat) => (
              <View
                key={voterSeat}
                testID={TESTIDS.sheriffAbstainChip(round.key, voterSeat)}
                accessibilityLabel={`${voterSeat + 1}号弃票`}
              >
                <SeatDot seat={voterSeat} size="sm" />
              </View>
            ))}
          </View>
        )}
        {round.eligibleVoterSeats.length === 0 && <Text style={styles.emptyBallots}>无投票人</Text>}
      </View>
    </View>
  );
}

const SheriffElectionPanelComponent: React.FC<SheriffElectionPanelProps> = ({ model, styles }) => {
  const { view, pendingAction } = model;
  const myBallotText = getMyBallotText(view.myBallot);
  const { candidateRecords } = view;
  const shouldShowActiveCandidates =
    candidateRecords !== null &&
    !areSameSeats(candidateRecords.registeredSeats, candidateRecords.activeCandidateSeats);
  const activeCandidateLabel =
    view.phase === 'runoffSpeech' || view.phase === 'runoffVote' ? '平票候选' : '候选';
  const decidingRoundKey = view.completedRounds[view.completedRounds.length - 1]?.key;

  return (
    <View style={styles.container} testID={TESTIDS.sheriffElectionPanel}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons
            name="shield-checkmark-outline"
            size={componentSizes.icon.md}
            color={colors.primary}
          />
          <Text style={styles.title}>警长竞选</Text>
        </View>
        <View style={styles.phaseBadge} testID={TESTIDS.sheriffElectionPhase}>
          <Text style={styles.phaseBadgeText}>{view.phaseTitle}</Text>
        </View>
      </View>

      <Text style={styles.description}>{view.phaseDescription}</Text>

      {view.finalResult !== null && (
        <ResultBanner
          result={view.finalResult}
          completedRounds={view.completedRounds}
          styles={styles}
        />
      )}

      {candidateRecords !== null && (
        <View style={styles.records}>
          <View style={styles.recordRow}>
            <Text style={styles.recordLabel}>上警</Text>
            <View style={styles.recordValueColumn}>
              <View style={styles.seatDotRow} testID={TESTIDS.sheriffRegisteredSeats}>
                {candidateRecords.registeredSeats.length === 0 ? (
                  <Text style={styles.recordEmpty}>无</Text>
                ) : (
                  candidateRecords.registeredSeats.map((seat) => {
                    const isWithdrawn = candidateRecords.withdrawnSeats.includes(seat);
                    return (
                      <SeatDot
                        key={seat}
                        seat={seat}
                        withdrawn={isWithdrawn}
                        stateLabel={isWithdrawn ? '已退水' : undefined}
                        testID={TESTIDS.sheriffRegisteredSeatDot(seat)}
                      />
                    );
                  })
                )}
              </View>
              {candidateRecords.withdrawnSeats.length > 0 && (
                <Text style={styles.withdrawnNote} testID={TESTIDS.sheriffWithdrawnSeats}>
                  {candidateRecords.withdrawnSeats
                    .map((seat) => `${formatSeat(seat)}已退水`)
                    .join('、')}
                </Text>
              )}
            </View>
          </View>
          {shouldShowActiveCandidates && (
            <View style={styles.recordRow}>
              <Text style={styles.recordLabel}>{activeCandidateLabel}</Text>
              <View style={styles.recordValueColumn}>
                <View style={styles.seatDotRow} testID={TESTIDS.sheriffActiveCandidateSeats}>
                  {candidateRecords.activeCandidateSeats.map((seat) => (
                    <SeatDot
                      key={seat}
                      seat={seat}
                      testID={TESTIDS.sheriffActiveCandidateSeatDot(seat)}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}
          {view.speakingInstruction !== null && (
            <View style={styles.recordRow}>
              <Text style={styles.recordLabel}>发言顺序</Text>
              <Text style={styles.recordValue} testID={TESTIDS.sheriffSpeakingInstruction}>
                {view.speakingInstruction}
              </Text>
            </View>
          )}
        </View>
      )}

      {view.voteProgress !== null && (
        <View style={styles.candidateSection}>
          <View style={styles.voteStatusRow}>
            <Text style={styles.sectionTitle}>{view.canVote ? '选择候选人' : '投票进度'}</Text>
            <Text style={styles.voteProgress} testID={TESTIDS.sheriffVoteProgress}>
              {view.voteProgress.submittedCount}/{view.voteProgress.eligibleCount} 已提交
            </Text>
          </View>
          {view.canVote && (
            <>
              <View
                style={styles.candidateGrid}
                accessibilityRole="radiogroup"
                accessibilityLabel="警长候选人"
              >
                {view.candidateOptions.map((option) => (
                  <BallotChoice
                    key={option.seat}
                    targetSeat={option.seat}
                    isSelected={option.isSelected}
                    pendingAction={pendingAction}
                    onVote={model.vote}
                    testID={TESTIDS.sheriffCandidateButton(option.seat)}
                    styles={styles}
                  />
                ))}
                <BallotChoice
                  targetSeat={null}
                  isSelected={view.myBallot?.kind === 'abstained'}
                  pendingAction={pendingAction}
                  onVote={model.vote}
                  testID={TESTIDS.sheriffAbstainButton}
                  styles={styles}
                />
              </View>
              {myBallotText !== null && <Text style={styles.ballotStatus}>{myBallotText}</Text>}
            </>
          )}
        </View>
      )}

      {view.completedRounds.length > 0 && <View style={styles.divider} />}
      {view.completedRounds.map((round) => (
        <CompletedRound
          key={round.key}
          round={round}
          winnerSeat={
            view.finalResult?.kind === 'elected' && round.key === decidingRoundKey
              ? view.finalResult.sheriffSeat
              : null
          }
          styles={styles}
        />
      ))}
    </View>
  );
};

export const SheriffElectionPanel = memo(SheriffElectionPanelComponent);
SheriffElectionPanel.displayName = 'SheriffElectionPanel';
