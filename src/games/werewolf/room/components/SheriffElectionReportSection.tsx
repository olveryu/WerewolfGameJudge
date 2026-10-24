/**
 * Sheriff-election section of the night report, rendered with the panel's
 * read-only presentation.
 *
 * The report renders the same pieces the election panel renders — phase
 * header, result banner, candidate records, vote progress, closed-round
 * tallies — from the report's own section projection. It never renders the
 * panel's controls: there is no ballot grid, no own-ballot status, and no
 * host action here, because the archive is read-only. The outer night
 * report card (white surface) stays with NightReviewReportBody; this file
 * owns only the panel pieces inside it.
 *
 * Panel copy is the single source: phase titles/descriptions and round
 * titles come from sheriffElectionViewModel, and the section carries the
 * phase, the full registration and the submission counts so nothing here
 * is re-derived. Speaking order is the one panel row the report does not
 * render: the section carries no speaking data, and the plan does not ask
 * for it.
 */

import { useMemo } from 'react';

import { colors } from '@/theme';

import type { NightReviewSheriffRound, NightReviewSheriffSection } from '../NightReview.helpers';
import {
  getSheriffElectionRoundTitle,
  SHERIFF_ELECTION_PHASE_CONTENT,
  type SheriffElectionRoundViewModel,
} from '../sheriffElectionViewModel';
import { createSheriffElectionPanelStyles } from './sheriffElectionPanel.styles';
import {
  getSheriffCompletedRoundWinnerSeat,
  SheriffElectionCompletedRound,
  SheriffElectionPhaseHeader,
  SheriffElectionRecords,
  SheriffElectionResultBanner,
  SheriffElectionVoteProgressRow,
} from './SheriffElectionReadOnly';

function toRoundViewModel(round: NightReviewSheriffRound): SheriffElectionRoundViewModel {
  return {
    key: round.round,
    title: getSheriffElectionRoundTitle(round.round),
    perCandidate: round.perCandidate,
    abstainingSeats: round.abstainingSeats,
  };
}

export function SheriffElectionReportSection({
  section,
}: {
  readonly section: NightReviewSheriffSection;
}) {
  const styles = useMemo(() => createSheriffElectionPanelStyles(colors), []);

  if (section.kind === 'registration') {
    // Registration secrecy: the panel header only — no records, no seats,
    // no counts, for anyone.
    const content = SHERIFF_ELECTION_PHASE_CONTENT.registration;
    return (
      <SheriffElectionPhaseHeader
        phaseTitle={content.title}
        phaseDescription={content.description}
        styles={styles}
      />
    );
  }

  if (section.kind === 'inProgress') {
    const content = SHERIFF_ELECTION_PHASE_CONTENT[section.phase];
    const rounds = section.closedRounds.map(toRoundViewModel);
    return (
      <>
        <SheriffElectionPhaseHeader
          phaseTitle={content.title}
          phaseDescription={content.description}
          styles={styles}
        />
        <SheriffElectionRecords
          candidateRecords={{
            registeredSeats: section.registeredSeats,
            withdrawnSeats: section.withdrawnSeats,
            activeCandidateSeats: section.candidateSeats,
          }}
          phase={section.phase}
          speakingInstruction={null}
          styles={styles}
        />
        {section.voteProgress !== null && (
          <SheriffElectionVoteProgressRow
            title="投票进度"
            submittedCount={section.voteProgress.submittedCount}
            eligibleCount={section.voteProgress.eligibleCount}
            styles={styles}
          />
        )}
        {rounds.map((round) => (
          <SheriffElectionCompletedRound
            key={round.key}
            round={round}
            winnerSeat={null}
            styles={styles}
          />
        ))}
      </>
    );
  }

  const content = SHERIFF_ELECTION_PHASE_CONTENT.completed;
  const rounds = section.rounds.map(toRoundViewModel);
  const decidingRoundKey = rounds[rounds.length - 1]?.key;
  return (
    <>
      <SheriffElectionPhaseHeader
        phaseTitle={content.title}
        phaseDescription={content.description}
        styles={styles}
      />
      <SheriffElectionResultBanner
        result={section.result}
        completedRounds={rounds}
        styles={styles}
      />
      <SheriffElectionRecords
        candidateRecords={{
          registeredSeats: section.registeredSeats,
          withdrawnSeats: section.withdrawnSeats,
          activeCandidateSeats: section.activeCandidateSeats,
        }}
        phase="completed"
        speakingInstruction={null}
        styles={styles}
      />
      {rounds.map((round) => (
        <SheriffElectionCompletedRound
          key={round.key}
          round={round}
          winnerSeat={getSheriffCompletedRoundWinnerSeat({
            result: section.result,
            roundKey: round.key,
            decidingRoundKey,
          })}
          styles={styles}
        />
      ))}
    </>
  );
}
