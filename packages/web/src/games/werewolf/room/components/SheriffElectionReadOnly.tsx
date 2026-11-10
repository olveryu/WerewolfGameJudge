/**
 * Read-only sheriff-election presentation, shared by the election panel's record sections.
 *
 * These pieces render projection rows and nothing else: every presentation decision (which rows
 * exist, in which order, who is the winner) is made once in `sheriffElectionPresentation`, and this
 * file only turns a row into its panel vocabulary (trophy, tally bar, SeatDot). It never derives a
 * record, never branches on a phase or a result, and never reads a ballot. Everything interactive
 * (ballot choices, the effective player's own ballot, host advance) stays in SheriffElectionPanel.
 */
import './SheriffElection.css';

import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { SeatDot } from '@/components/SeatDot';
import { PendingSeatsRow } from '@/features/room/components/PendingSeatsRow';
import type { SheriffElectionPresentationRow } from '@/games/werewolf/room/day/sheriffElectionPresentation';
import { TESTIDS } from '@/testids';
import IconShieldCheckmark from '~icons/ion/shield-checkmark';
import IconShieldCheckmarkOutline from '~icons/ion/shield-checkmark-outline';
import IconShieldOutline from '~icons/ion/shield-outline';
import IconTrophy from '~icons/ion/trophy';

type SheriffRow<TKind extends SheriffElectionPresentationRow['kind']> = Extract<
  SheriffElectionPresentationRow,
  { readonly kind: TKind }
>;

/** Panel header: shield mark, title, phase badge, and phase description. */
export function SheriffElectionPhaseHeader({
  phaseTitle,
  phaseDescription,
}: {
  readonly phaseTitle: string;
  readonly phaseDescription: string;
}) {
  return (
    <>
      <div className="sheriff-panel-header">
        <span className="sheriff-title-group">
          <IconShieldCheckmarkOutline aria-hidden />
          <h2 className="sheriff-panel-title">警长竞选</h2>
        </span>
        <span className="sheriff-phase-badge" data-testid={TESTIDS.sheriffElectionPhase}>
          {phaseTitle}
        </span>
      </div>
      <p className="sheriff-description">{phaseDescription}</p>
    </>
  );
}

/** Outcome banner: gold medal block for an elected sheriff, neutral otherwise. */
export function SheriffElectionResultBanner({ row }: { readonly row: SheriffRow<'result'> }) {
  const isElected = row.resultKind === 'elected';
  return (
    <div
      className="sheriff-result"
      data-elected={isElected}
      data-testid={TESTIDS.sheriffElectionResult}
    >
      <span className="sheriff-result-medal" aria-hidden>
        {isElected ? <IconShieldCheckmark /> : <IconShieldOutline />}
      </span>
      <div className="sheriff-result-text">
        <span className="sheriff-result-title">{row.bannerTitle}</span>
        {row.bannerSubtitle !== null && (
          <span className="sheriff-result-subtitle">{row.bannerSubtitle}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Candidate records: the registration row (withdrawn seats marked and noted), the still-standing
 * candidate row (only when the projection emits one), and the speaking order when the projection
 * emits one.
 */
export function SheriffElectionRecords({
  registrationRow,
  candidatesRow,
  speakingRow,
}: {
  readonly registrationRow: SheriffRow<'registration'>;
  readonly candidatesRow: SheriffRow<'candidates'> | null;
  readonly speakingRow: SheriffRow<'speaking'> | null;
}) {
  return (
    <div className="sheriff-records">
      <div className="sheriff-record-row">
        <span className="sheriff-record-label">上警</span>
        <div className="sheriff-record-column">
          <div className="sheriff-seat-dots" data-testid={TESTIDS.sheriffRegisteredSeats}>
            {registrationRow.seats.length === 0 ? (
              <span className="sheriff-record-empty">无</span>
            ) : (
              registrationRow.seats.map(({ seat, isWithdrawn }) => (
                <SeatDot
                  key={seat}
                  seat={seat}
                  withdrawn={isWithdrawn}
                  {...(isWithdrawn ? { stateLabel: '已退水' } : {})}
                  testId={TESTIDS.sheriffRegisteredSeatDot(seat)}
                />
              ))
            )}
          </div>
          {registrationRow.withdrawnNote !== null && (
            <p className="sheriff-withdrawn-note" data-testid={TESTIDS.sheriffWithdrawnSeats}>
              {registrationRow.withdrawnNote}
            </p>
          )}
        </div>
      </div>
      {candidatesRow !== null && (
        <div className="sheriff-record-row">
          <span className="sheriff-record-label">{candidatesRow.label}</span>
          <div className="sheriff-record-column">
            <div className="sheriff-seat-dots" data-testid={TESTIDS.sheriffActiveCandidateSeats}>
              {candidatesRow.seats.map((seat) => (
                <SeatDot
                  key={seat}
                  seat={seat}
                  testId={TESTIDS.sheriffActiveCandidateSeatDot(seat)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      {speakingRow !== null && (
        <div className="sheriff-record-row">
          <span className="sheriff-record-label">发言顺序</span>
          <span className="sheriff-record-value" data-testid={TESTIDS.sheriffSpeakingInstruction}>
            {speakingRow.text}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Vote submission progress as read-only text: how many eligible voters have submitted and which
 * seats have not, never who voted for whom. The settle countdown lives only in the HUD.
 */
export function SheriffElectionVoteProgressRow({
  title,
  row,
}: {
  readonly title: string;
  readonly row: SheriffRow<'voteProgress'>;
}) {
  return (
    <>
      <div className="sheriff-vote-status">
        <h3 className="sheriff-section-title">{title}</h3>
        <span className="sheriff-vote-progress" data-testid={TESTIDS.sheriffVoteProgress}>
          {row.text}
        </span>
      </div>
      {row.pendingSeats.length > 0 && (
        <div className="sheriff-vote-pending">
          <PendingSeatsRow
            label="未投票"
            seats={row.pendingSeats}
            testId={TESTIDS.sheriffVoteProgressPendingSeats}
          />
        </div>
      )}
    </>
  );
}

/**
 * One closed round as a tally card: a bar per candidate with that candidate's voters grouped
 * underneath, and abstentions demoted to one grey line. The winner flag arrives on the row from
 * the projection; this component only paints it.
 */
export function SheriffElectionCompletedRound({ row }: { readonly row: SheriffRow<'round'> }) {
  const totalVotes = row.candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  return (
    <section className="sheriff-round" data-testid={TESTIDS.sheriffCompletedRound(row.key)}>
      <h3 className="sheriff-section-title">{row.title}</h3>
      <div className="sheriff-tally-card">
        {row.candidates.map((candidate) => (
          <div
            key={candidate.seat}
            className="sheriff-tally-group"
            data-winner={candidate.isWinner}
            data-testid={TESTIDS.sheriffTallyGroup(row.key, candidate.seat)}
          >
            <div className="sheriff-tally-row">
              <span className="sheriff-tally-name">{formatSeat(candidate.seat)}</span>
              {candidate.isWinner && <IconTrophy className="sheriff-tally-trophy" aria-hidden />}
              <span className="sheriff-tally-track" aria-hidden>
                {candidate.votes > 0 && (
                  <span className="sheriff-tally-fill" style={{ flexGrow: candidate.votes }} />
                )}
                {candidate.votes < totalVotes && (
                  <span style={{ flexGrow: totalVotes - candidate.votes }} />
                )}
              </span>
              <span className="sheriff-tally-count">{candidate.votes} 票</span>
            </div>
            {candidate.voterSeats.length > 0 && (
              <div
                className="sheriff-voter-chips"
                role="group"
                aria-label={`${formatSeat(candidate.seat)}的投票人`}
              >
                {candidate.voterSeats.map((voterSeat) => (
                  <span
                    key={voterSeat}
                    className="sheriff-voter-chip"
                    data-testid={TESTIDS.sheriffBallotChip(row.key, voterSeat)}
                  >
                    <SeatDot seat={voterSeat} size="sm" />
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {row.abstainingSeats.length > 0 && (
          <div className="sheriff-abstain-row" data-testid={TESTIDS.sheriffAbstainRow(row.key)}>
            <span className="sheriff-abstain-label">弃票</span>
            {row.abstainingSeats.map((voterSeat) => (
              <span
                key={voterSeat}
                data-testid={TESTIDS.sheriffAbstainChip(row.key, voterSeat)}
                role="img"
                aria-label={`${voterSeat + 1}号弃票`}
              >
                <SeatDot seat={voterSeat} size="sm" />
              </span>
            ))}
          </div>
        )}
        {row.isEmpty && <span className="sheriff-empty-ballots">无投票人</span>}
      </div>
    </section>
  );
}
