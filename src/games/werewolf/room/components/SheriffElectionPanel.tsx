/**
 * Presentational sheriff-election panel.
 *
 * Renders the state-driven public record and reports user intent through the
 * supplied panel model. It does not derive eligibility or call services.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { SheriffElectionResult } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import type React from 'react';
import { memo, useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type {
  SheriffElectionPanelModel,
  SheriffElectionPendingAction,
} from '@/games/werewolf/room/hooks/useSheriffElection';
import type { SheriffBallotSelectionViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
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
  readonly isInteractionDisabled: boolean;
  readonly onVote: (targetSeat: number | null) => Promise<void>;
  readonly testID: string;
  readonly styles: SheriffElectionPanelStyles;
}

const BallotChoice: React.FC<BallotChoiceProps> = memo(
  ({ targetSeat, isSelected, pendingAction, isInteractionDisabled, onVote, testID, styles }) => {
    const handlePress = useCallback(() => {
      void onVote(targetSeat);
    }, [onVote, targetSeat]);
    const isLoading = pendingAction?.kind === 'vote' && pendingAction.targetSeat === targetSeat;
    const isDisabled = isInteractionDisabled || pendingAction !== null;
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

function formatSeatList(seats: readonly number[]): string {
  return seats.length === 0 ? '无' : seats.map(formatSeat).join(' · ');
}

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

function getFinalResultText(result: SheriffElectionResult): string {
  if (result.kind === 'elected') return `${formatSeat(result.sheriffSeat)} 当选警长`;
  switch (result.reason) {
    case 'noCandidates':
      return '无人参选，本局没有警长';
    case 'noVotes':
      return '无人得票，本局没有警长';
    case 'runoffTie':
      return '平票未决，本局没有警长';
  }
}

const SheriffElectionPanelComponent: React.FC<SheriffElectionPanelProps> = ({ model, styles }) => {
  const { view, pendingAction, isInteractionDisabled } = model;
  const myBallotText = getMyBallotText(view.myBallot);
  const { candidateRecords } = view;
  const shouldShowActiveCandidates =
    candidateRecords !== null &&
    !areSameSeats(candidateRecords.registeredSeats, candidateRecords.activeCandidateSeats);
  const activeCandidateLabel =
    view.phase === 'runoffSpeech' || view.phase === 'runoffVote' ? '平票候选' : '候选';

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

      {candidateRecords !== null && (
        <View style={styles.records}>
          <View style={styles.recordRow}>
            <Text style={styles.recordLabel}>上警</Text>
            <Text style={styles.recordValue} testID={TESTIDS.sheriffRegisteredSeats}>
              {formatSeatList(candidateRecords.registeredSeats)}
            </Text>
          </View>
          <View style={styles.recordRow}>
            <Text style={styles.recordLabel}>退水</Text>
            <Text style={styles.recordValue} testID={TESTIDS.sheriffWithdrawnSeats}>
              {formatSeatList(candidateRecords.withdrawnSeats)}
            </Text>
          </View>
          {shouldShowActiveCandidates && (
            <View style={styles.recordRow}>
              <Text style={styles.recordLabel}>{activeCandidateLabel}</Text>
              <Text style={styles.recordValue} testID={TESTIDS.sheriffActiveCandidateSeats}>
                {formatSeatList(candidateRecords.activeCandidateSeats)}
              </Text>
            </View>
          )}
          {view.speakingOrder.length > 0 && (
            <View style={styles.recordRow}>
              <Text style={styles.recordLabel}>发言顺序</Text>
              <Text style={styles.recordValue} testID={TESTIDS.sheriffSpeakingOrder}>
                {formatSeatList(view.speakingOrder)}
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
                    isInteractionDisabled={isInteractionDisabled}
                    onVote={model.vote}
                    testID={TESTIDS.sheriffCandidateButton(option.seat)}
                    styles={styles}
                  />
                ))}
                <BallotChoice
                  targetSeat={null}
                  isSelected={view.myBallot?.kind === 'abstained'}
                  pendingAction={pendingAction}
                  isInteractionDisabled={isInteractionDisabled}
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
        <View
          key={round.key}
          style={styles.roundSection}
          testID={TESTIDS.sheriffCompletedRound(round.key)}
        >
          <Text style={styles.roundTitle}>{round.title}</Text>
          <View style={styles.tallyList}>
            {round.candidateSeats.map((seat) => {
              const voteCount = round.voteCounts[seat];
              if (voteCount === undefined) {
                throw new Error(`[FAIL-FAST] Sheriff round view has no count for seat ${seat}`);
              }
              return (
                <View key={seat} style={styles.tallyRow}>
                  <Text style={styles.tallySeat}>{formatSeat(seat)}</Text>
                  <Text style={styles.tallyValue}>{voteCount}票</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.ballotListTitle}>投票明细</Text>
          <View style={styles.ballotList}>
            {round.eligibleVoterSeats.length === 0 ? (
              <Text style={styles.emptyBallots}>无投票人</Text>
            ) : (
              round.eligibleVoterSeats.map((voterSeat) => {
                const targetSeat = round.ballots[voterSeat];
                if (targetSeat === undefined) {
                  throw new Error(
                    `[FAIL-FAST] Sheriff round view has no ballot for seat ${voterSeat}`,
                  );
                }
                return (
                  <View key={voterSeat} style={styles.ballotRow}>
                    <Text style={styles.ballotSeat}>{formatSeat(voterSeat)}</Text>
                    <Text style={styles.ballotArrow}>→</Text>
                    <Text style={styles.ballotTarget}>
                      {targetSeat === null ? '弃票' : formatSeat(targetSeat)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      ))}

      {view.finalResult !== null && (
        <View style={styles.finalBanner} testID={TESTIDS.sheriffElectionResult}>
          <Text style={styles.finalText}>{getFinalResultText(view.finalResult)}</Text>
        </View>
      )}
    </View>
  );
};

export const SheriffElectionPanel = memo(SheriffElectionPanelComponent);
SheriffElectionPanel.displayName = 'SheriffElectionPanel';
