/**
 * Presentational sheriff-election panel.
 *
 * Renders the state-driven public record and reports user intent through the supplied panel model.
 * It does not derive eligibility or call services. The record is drawn graphically first: seat
 * dots for candidacy, tally bars with voters grouped under their candidate, and a banner for the
 * outcome.
 */
import './SheriffElection.css';

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { Spinner } from '@/components/Spinner';
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
import IconCheckmarkCircle from '~icons/ion/checkmark-circle';

import {
  SheriffElectionCompletedRound,
  SheriffElectionPhaseHeader,
  SheriffElectionRecords,
  SheriffElectionResultBanner,
  SheriffElectionVoteProgressRow,
} from './SheriffElectionReadOnly';

function BallotChoice({
  targetSeat,
  isSelected,
  pendingAction,
  onVote,
  testId,
}: {
  readonly targetSeat: number | null;
  readonly isSelected: boolean;
  readonly pendingAction: SheriffElectionPendingAction | null;
  readonly onVote: (targetSeat: number | null) => Promise<void>;
  readonly testId: string;
}) {
  const isLoading = pendingAction?.kind === 'vote' && pendingAction.targetSeat === targetSeat;
  const label = targetSeat === null ? '弃票' : formatSeat(targetSeat);
  return (
    <button
      type="button"
      role="radio"
      className="sheriff-ballot-choice"
      aria-checked={isSelected}
      aria-busy={isLoading}
      aria-label={targetSeat === null ? '弃票' : `投给${label}`}
      disabled={pendingAction !== null}
      data-testid={testId}
      onClick={() => void onVote(targetSeat)}
    >
      <span className="sheriff-ballot-indicator">
        {isLoading ? (
          <Spinner label="投票提交中" />
        ) : isSelected ? (
          <IconCheckmarkCircle aria-hidden />
        ) : null}
      </span>
      {label}
    </button>
  );
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

export function SheriffElectionPanel({ model }: { readonly model: SheriffElectionPanelModel }) {
  const { view, pendingAction } = model;
  const myBallotText = getMyBallotText(view.myBallot);
  // The panel renders the projection, not the view model fields directly: every presentation
  // decision (rows, order, winner) is made once in the projection. Ballot interaction still reads
  // the view model.
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
    <div className="sheriff-panel" data-testid={TESTIDS.sheriffElectionPanel}>
      <SheriffElectionPhaseHeader
        phaseTitle={phaseRow.title}
        phaseDescription={phaseRow.description}
      />

      {resultRow !== undefined && <SheriffElectionResultBanner row={resultRow} />}

      {registrationRow !== undefined && (
        <SheriffElectionRecords
          registrationRow={registrationRow}
          candidatesRow={candidatesRow}
          speakingRow={speakingRow}
        />
      )}

      {view.voteProgress !== null && voteProgressRow !== undefined && (
        <div className="sheriff-candidates">
          <SheriffElectionVoteProgressRow
            title={view.canVote ? '选择候选人' : '投票进度'}
            row={voteProgressRow}
          />
          {view.canVote && (
            <>
              <div className="sheriff-candidate-grid" role="radiogroup" aria-label="警长候选人">
                {view.candidateOptions.map((option) => (
                  <BallotChoice
                    key={option.seat}
                    targetSeat={option.seat}
                    isSelected={option.isSelected}
                    pendingAction={pendingAction}
                    onVote={model.vote}
                    testId={TESTIDS.sheriffCandidateButton(option.seat)}
                  />
                ))}
                <BallotChoice
                  targetSeat={null}
                  isSelected={view.myBallot?.kind === 'abstained'}
                  pendingAction={pendingAction}
                  onVote={model.vote}
                  testId={TESTIDS.sheriffAbstainButton}
                />
              </div>
              {myBallotText !== null && <p className="sheriff-ballot-status">{myBallotText}</p>}
            </>
          )}
        </div>
      )}

      {roundRows.length > 0 && <hr className="sheriff-divider" />}
      {roundRows.map((row) => (
        <SheriffElectionCompletedRound key={row.key} row={row} />
      ))}
    </div>
  );
}
