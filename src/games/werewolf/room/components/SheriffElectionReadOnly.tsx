/**
 * Read-only sheriff-election presentation, shared by the election panel and
 * the night report.
 *
 * These pieces render projection rows and nothing else: every presentation
 * decision (which rows exist, in which order, who is the winner) is made
 * once in `sheriffElectionPresentation`, and this file only turns a row
 * into its panel vocabulary (trophy, tally bar, SeatDot). It never derives
 * a record, never branches on a phase or a result, and never reads a
 * ballot. Everything interactive (ballot choices, the effective player's
 * own ballot, host advance) stays in SheriffElectionPanel and never enters
 * this file, so the report can render the panel's UI without inheriting
 * the panel's controls.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { Text, View } from 'react-native';

import { SeatDot } from '@/components/SeatDot';
import { PendingSeatsRow } from '@/features/room/components/PendingSeatsRow';
import {
  getSettleCountdownSuffix,
  type SheriffElectionPresentationRow,
} from '@/games/werewolf/room/day/sheriffElectionPresentation';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import type { SheriffElectionPanelStyles } from './sheriffElectionPanel.styles';

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

type SheriffResultRow = Extract<SheriffElectionPresentationRow, { readonly kind: 'result' }>;
type SheriffRegistrationRow = Extract<
  SheriffElectionPresentationRow,
  { readonly kind: 'registration' }
>;
type SheriffCandidatesRow = Extract<
  SheriffElectionPresentationRow,
  { readonly kind: 'candidates' }
>;
type SheriffSpeakingRow = Extract<SheriffElectionPresentationRow, { readonly kind: 'speaking' }>;
type SheriffVoteProgressRow = Extract<
  SheriffElectionPresentationRow,
  { readonly kind: 'voteProgress' }
>;
type SheriffRoundRow = Extract<SheriffElectionPresentationRow, { readonly kind: 'round' }>;

interface SheriffElectionResultBannerProps {
  readonly row: SheriffResultRow;
  readonly styles: SheriffElectionPanelStyles;
}

/** Outcome banner: gold medal block for an elected sheriff, neutral otherwise. */
export function SheriffElectionResultBanner({ row, styles }: SheriffElectionResultBannerProps) {
  const isElected = row.resultKind === 'elected';

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
        <Text style={styles.resultTitle}>{row.bannerTitle}</Text>
        {row.bannerSubtitle !== null && (
          <Text style={styles.resultSubtitle}>{row.bannerSubtitle}</Text>
        )}
      </View>
    </View>
  );
}

interface SheriffElectionRecordsProps {
  readonly registrationRow: SheriffRegistrationRow;
  readonly candidatesRow: SheriffCandidatesRow | null;
  readonly speakingRow: SheriffSpeakingRow | null;
  readonly styles: SheriffElectionPanelStyles;
}

/**
 * Candidate records: the registration row (withdrawn seats marked and
 * noted), the still-standing candidate row (only when the projection
 * emits one), and the speaking order when the projection emits one. The
 * registration row always shows every registered seat; the candidate row
 * renders the projection's active seats.
 */
export function SheriffElectionRecords({
  registrationRow,
  candidatesRow,
  speakingRow,
  styles,
}: SheriffElectionRecordsProps) {
  return (
    <View style={styles.records}>
      <View style={styles.recordRow}>
        <Text style={styles.recordLabel}>上警</Text>
        <View style={styles.recordValueColumn}>
          <View style={styles.seatDotRow} testID={TESTIDS.sheriffRegisteredSeats}>
            {registrationRow.seats.length === 0 ? (
              <Text style={styles.recordEmpty}>无</Text>
            ) : (
              registrationRow.seats.map(({ seat, isWithdrawn }) => (
                <SeatDot
                  key={seat}
                  seat={seat}
                  withdrawn={isWithdrawn}
                  stateLabel={isWithdrawn ? '已退水' : undefined}
                  testID={TESTIDS.sheriffRegisteredSeatDot(seat)}
                />
              ))
            )}
          </View>
          {registrationRow.withdrawnNote !== null && (
            <Text style={styles.withdrawnNote} testID={TESTIDS.sheriffWithdrawnSeats}>
              {registrationRow.withdrawnNote}
            </Text>
          )}
        </View>
      </View>
      {candidatesRow !== null && (
        <View style={styles.recordRow}>
          <Text style={styles.recordLabel}>{candidatesRow.label}</Text>
          <View style={styles.recordValueColumn}>
            <View style={styles.seatDotRow} testID={TESTIDS.sheriffActiveCandidateSeats}>
              {candidatesRow.seats.map((seat) => (
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
      {speakingRow !== null && (
        <View style={styles.recordRow}>
          <Text style={styles.recordLabel}>发言顺序</Text>
          <Text style={styles.recordValue} testID={TESTIDS.sheriffSpeakingInstruction}>
            {speakingRow.text}
          </Text>
        </View>
      )}
    </View>
  );
}

interface SheriffElectionVoteProgressRowProps {
  readonly title: string;
  readonly row: SheriffVoteProgressRow;
  /** Live seconds of the armed settle countdown, or null when unarmed. */
  readonly remainingSeconds: number | null;
  readonly styles: SheriffElectionPanelStyles;
}

/**
 * Vote submission progress as read-only text: how many eligible voters
 * have submitted and which seats have not, never who voted for whom. The
 * panel passes its own section title （选择候选人 while the viewer can
 * still vote）; read-only surfaces pass 投票进度. The progress line
 * itself comes from the projection, so both surfaces print the same text;
 * the countdown suffix is live-appended here (never in the projection,
 * so the night review keeps the plain `x/y 已提交`): once every voter
 * has submitted it reads `，N秒后自动公布结果` while seconds remain and
 * `，即将自动公布结果` at 0 or before the deadline arrives — never a
 * literal 0. While the vote is still open there is no suffix.
 */
export function SheriffElectionVoteProgressRow({
  title,
  row,
  remainingSeconds,
  styles,
}: SheriffElectionVoteProgressRowProps) {
  const countdownSuffix =
    row.submittedCount >= row.eligibleCount ? getSettleCountdownSuffix(remainingSeconds) : '';
  return (
    <>
      <View style={styles.voteStatusRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.voteProgress} testID={TESTIDS.sheriffVoteProgress}>
          {row.text}
          {countdownSuffix}
        </Text>
      </View>
      {row.pendingSeats.length > 0 && (
        <View style={styles.voteProgressPending}>
          <PendingSeatsRow
            label="未投票"
            seats={row.pendingSeats}
            testID={TESTIDS.sheriffVoteProgressPendingSeats}
          />
        </View>
      )}
    </>
  );
}

interface SheriffElectionCompletedRoundProps {
  readonly row: SheriffRoundRow;
  readonly styles: SheriffElectionPanelStyles;
}

/**
 * One closed round as a tally card: a bar per candidate with that candidate's
 * voters grouped underneath, and abstentions demoted to one grey line.
 * The winner flag arrives on the row from the projection; this component
 * only paints it.
 */
export function SheriffElectionCompletedRound({ row, styles }: SheriffElectionCompletedRoundProps) {
  const totalVotes = row.candidates.reduce((sum, candidate) => sum + candidate.votes, 0);

  return (
    <View style={styles.roundSection} testID={TESTIDS.sheriffCompletedRound(row.key)}>
      <Text style={styles.roundTitle}>{row.title}</Text>
      <View style={styles.tallyCard}>
        {row.candidates.map((candidate, index) => {
          const seat = candidate.seat;
          const voteCount = candidate.votes;
          const isWinner = candidate.isWinner;
          const voters = candidate.voterSeats;
          return (
            <View
              key={seat}
              style={[styles.tallyGroup, index > 0 && styles.tallyGroupBorder]}
              testID={TESTIDS.sheriffTallyGroup(row.key, seat)}
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
                      testID={TESTIDS.sheriffBallotChip(row.key, voterSeat)}
                    >
                      <SeatDot seat={voterSeat} size="sm" />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        {row.abstainingSeats.length > 0 && (
          <View style={styles.abstainRow} testID={TESTIDS.sheriffAbstainRow(row.key)}>
            <Text style={styles.abstainLabel}>弃票</Text>
            {row.abstainingSeats.map((voterSeat) => (
              <View
                key={voterSeat}
                testID={TESTIDS.sheriffAbstainChip(row.key, voterSeat)}
                accessibilityLabel={`${voterSeat + 1}号弃票`}
              >
                <SeatDot seat={voterSeat} size="sm" />
              </View>
            ))}
          </View>
        )}
        {row.isEmpty && <Text style={styles.emptyBallots}>无投票人</Text>}
      </View>
    </View>
  );
}
