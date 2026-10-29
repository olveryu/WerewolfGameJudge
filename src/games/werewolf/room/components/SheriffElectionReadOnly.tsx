/**
 * Read-only sheriff-election presentation, shared by the election panel and
 * the night report.
 *
 * These pieces render the public election record and never derive it, never
 * report user intent, and never read a ballot: the tally and the candidate
 * records arrive from sheriffElectionRecord through the caller's view
 * model or report section. Everything interactive (ballot choices, the
 * effective player's own ballot, host advance) stays in
 * SheriffElectionPanel and never enters this file, so the report can render
 * the panel's UI without inheriting the panel's controls.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { SheriffElectionResult } from '@game-judge/game-engine/games/werewolf/public';
import type { SheriffElectionState } from '@game-judge/game-engine/games/werewolf/public';
import type { SheriffCandidateRecords } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { Text, View } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
import type { SheriffElectionRoundViewModel } from '@/games/werewolf/room/sheriffElectionViewModel';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import type { SheriffElectionPanelStyles } from './sheriffElectionPanel.styles';

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

interface SheriffElectionPhaseHeaderProps {
  readonly phaseTitle: string;
  readonly phaseDescription: string;
  readonly styles: SheriffElectionPanelStyles;
}

/** Panel header: shield mark, title, phase badge, and phase description. */
export function SheriffElectionPhaseHeader({
  phaseTitle,
  phaseDescription,
  styles,
}: SheriffElectionPhaseHeaderProps) {
  return (
    <>
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
          <Text style={styles.phaseBadgeText}>{phaseTitle}</Text>
        </View>
      </View>
      <Text style={styles.description}>{phaseDescription}</Text>
    </>
  );
}

interface SheriffElectionResultBannerProps {
  readonly result: SheriffElectionResult;
  readonly completedRounds: readonly { readonly key: SheriffElectionRoundViewModel['key'] }[];
  readonly styles: SheriffElectionPanelStyles;
}

/** Outcome banner: gold medal block for an elected sheriff, neutral otherwise. */
export function SheriffElectionResultBanner({
  result,
  completedRounds,
  styles,
}: SheriffElectionResultBannerProps) {
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

function areSameSeats(first: readonly number[], second: readonly number[]): boolean {
  return first.length === second.length && first.every((seat, index) => seat === second[index]);
}

interface SheriffElectionRecordsProps {
  readonly candidateRecords: SheriffCandidateRecords;
  readonly phase: SheriffElectionState['phase'];
  readonly speakingInstruction: string | null;
  readonly styles: SheriffElectionPanelStyles;
}

/**
 * Candidate records: the registration row (withdrawn seats marked and
 * noted), the still-standing candidate row (only when it differs from the
 * registration), and the speaking order when one is in effect. The
 * registration row always shows every registered seat; the candidate row
 * never re-derives a set — it renders the record's active seats.
 */
export function SheriffElectionRecords({
  candidateRecords,
  phase,
  speakingInstruction,
  styles,
}: SheriffElectionRecordsProps) {
  const shouldShowActiveCandidates = !areSameSeats(
    candidateRecords.registeredSeats,
    candidateRecords.activeCandidateSeats,
  );
  const activeCandidateLabel =
    phase === 'runoffSpeech' || phase === 'runoffVote' ? '平票候选' : '候选';

  return (
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
      {speakingInstruction !== null && (
        <View style={styles.recordRow}>
          <Text style={styles.recordLabel}>发言顺序</Text>
          <Text style={styles.recordValue} testID={TESTIDS.sheriffSpeakingInstruction}>
            {speakingInstruction}
          </Text>
        </View>
      )}
    </View>
  );
}

interface SheriffElectionVoteProgressRowProps {
  readonly title: string;
  readonly submittedCount: number;
  readonly eligibleCount: number;
  readonly styles: SheriffElectionPanelStyles;
}

/**
 * Vote submission progress as read-only text: how many eligible voters
 * have submitted, never who voted for whom. The panel passes its own
 * section title （选择候选人 while the viewer can still vote）; read-only
 * surfaces pass 投票进度.
 */
export function SheriffElectionVoteProgressRow({
  title,
  submittedCount,
  eligibleCount,
  styles,
}: SheriffElectionVoteProgressRowProps) {
  return (
    <View style={styles.voteStatusRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.voteProgress} testID={TESTIDS.sheriffVoteProgress}>
        {submittedCount}/{eligibleCount} 已提交
      </Text>
    </View>
  );
}

interface SheriffElectionCompletedRoundProps {
  readonly round: SheriffElectionRoundViewModel;
  readonly winnerSeat: number | null;
  readonly styles: SheriffElectionPanelStyles;
}

/**
 * One closed round as a tally card: a bar per candidate with that candidate's
 * voters grouped underneath, and abstentions demoted to one grey line.
 * The tally comes from the shared record (sheriffElectionRecord) via the
 * caller — this component renders it and never re-derives it.
 */
export function SheriffElectionCompletedRound({
  round,
  winnerSeat,
  styles,
}: SheriffElectionCompletedRoundProps) {
  const totalVotes = round.perCandidate.reduce((sum, candidate) => sum + candidate.votes, 0);
  // A closed round fails fast on any missing ballot in the core, so zero
  // ballots cast means zero eligible voters — the same empty case the old
  // eligible-voter check rendered.
  const hasNoVoters = totalVotes + round.abstainingSeats.length === 0;

  return (
    <View style={styles.roundSection} testID={TESTIDS.sheriffCompletedRound(round.key)}>
      <Text style={styles.roundTitle}>{round.title}</Text>
      <View style={styles.tallyCard}>
        {round.perCandidate.map((candidate, index) => {
          const seat = candidate.seat;
          const voteCount = candidate.votes;
          const isWinner = winnerSeat === seat;
          const voters = candidate.voterSeats;
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
        {round.abstainingSeats.length > 0 && (
          <View style={styles.abstainRow} testID={TESTIDS.sheriffAbstainRow(round.key)}>
            <Text style={styles.abstainLabel}>弃票</Text>
            {round.abstainingSeats.map((voterSeat) => (
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
        {hasNoVoters && <Text style={styles.emptyBallots}>无投票人</Text>}
      </View>
    </View>
  );
}

interface SheriffCompletedRoundWinnerSeatInput {
  readonly result: SheriffElectionResult | null;
  readonly roundKey: SheriffElectionRoundViewModel['key'];
  readonly decidingRoundKey: SheriffElectionRoundViewModel['key'] | undefined;
}

/**
 * The winner highlight for one closed round: only the deciding round of an
 * elected result highlights its sheriff. Every other round renders with no
 * winner, in both the panel and the report.
 */
export function getSheriffCompletedRoundWinnerSeat({
  result,
  roundKey,
  decidingRoundKey,
}: SheriffCompletedRoundWinnerSeatInput): number | null {
  return result?.kind === 'elected' && roundKey === decidingRoundKey ? result.sheriffSeat : null;
}
