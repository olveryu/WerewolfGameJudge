/**
 * Presentational sheriff-election panel.
 *
 * Renders the state-driven public record and reports user intent through the
 * supplied panel model. It does not derive eligibility or call services.
 * The record is drawn graphically first: seat dots for candidacy, tally bars
 * with voters grouped under their candidate, and a banner for the outcome.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import type React from 'react';
import { memo, useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  createSheriffElectionPresentationFromView,
  type SheriffElectionPresentationRow,
} from '@/games/werewolf/room/day/sheriffElectionPresentation';
import type { SheriffBallotSelectionViewModel } from '@/games/werewolf/room/day/sheriffElectionViewModel';
import type {
  SheriffElectionPanelModel,
  SheriffElectionPendingAction,
} from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import type { SheriffElectionPanelStyles } from './sheriffElectionPanel.styles';
import {
  SheriffElectionCompletedRound,
  SheriffElectionPhaseHeader,
  SheriffElectionRecords,
  SheriffElectionResultBanner,
  SheriffElectionVoteProgressRow,
} from './SheriffElectionReadOnly';

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

const SheriffElectionPanelComponent: React.FC<SheriffElectionPanelProps> = ({ model, styles }) => {
  const { view, pendingAction } = model;
  const myBallotText = getMyBallotText(view.myBallot);
  // The panel renders the projection, not the view model fields directly:
  // every presentation decision (rows, order, winner) is made once in
  // the projection. Ballot interaction and host advance below are
  // unchanged and still read the view model.
  const presentation = createSheriffElectionPresentationFromView(view);
  const phaseRow = presentation.rows.find((row) => row.kind === 'phase');
  if (phaseRow === undefined) {
    throw new Error('[FAIL-FAST] Sheriff election presentation has no phase row');
  }
  const resultRow = presentation.rows.find((row) => row.kind === 'result');
  const registrationRow = presentation.rows.find((row) => row.kind === 'registration');
  const candidatesRow = presentation.rows.find((row) => row.kind === 'candidates') ?? null;
  const speakingRow = presentation.rows.find((row) => row.kind === 'speaking') ?? null;
  const voteProgressRow = presentation.rows.find((row) => row.kind === 'voteProgress');
  if (view.voteProgress !== null && voteProgressRow === undefined) {
    throw new Error('[FAIL-FAST] Sheriff election presentation has no vote-progress row');
  }
  const roundRows = presentation.rows.filter(
    (row): row is Extract<SheriffElectionPresentationRow, { readonly kind: 'round' }> =>
      row.kind === 'round',
  );

  return (
    <View style={styles.container} testID={TESTIDS.sheriffElectionPanel}>
      <SheriffElectionPhaseHeader
        phaseTitle={phaseRow.title}
        phaseDescription={phaseRow.description}
        styles={styles}
      />

      {resultRow !== undefined && <SheriffElectionResultBanner row={resultRow} styles={styles} />}

      {registrationRow !== undefined && (
        <SheriffElectionRecords
          registrationRow={registrationRow}
          candidatesRow={candidatesRow}
          speakingRow={speakingRow}
          styles={styles}
        />
      )}

      {view.voteProgress !== null && voteProgressRow !== undefined && (
        <View style={styles.candidateSection}>
          <SheriffElectionVoteProgressRow
            title={view.canVote ? '选择候选人' : '投票进度'}
            row={voteProgressRow}
            remainingSeconds={model.remainingSeconds}
            styles={styles}
          />
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

      {roundRows.length > 0 && <View style={styles.divider} />}
      {roundRows.map((row) => (
        <SheriffElectionCompletedRound key={row.key} row={row} styles={styles} />
      ))}
    </View>
  );
};

export const SheriffElectionPanel = memo(SheriffElectionPanelComponent);
SheriffElectionPanel.displayName = 'SheriffElectionPanel';
