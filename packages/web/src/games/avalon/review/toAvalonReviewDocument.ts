/**
 * The Avalon review document: one page — the verdict, the quest score,
 * every identity, the table's configuration, the lady-of-the-lake checks
 * on 9/10-seat tables, and every proposal of every quest that started.
 *
 * Facts come from the ended view model's public projection, where every
 * role is revealed, read through the room's own selectors and copy: the
 * ended instruction and end-reason copy for the verdict, the board info
 * sections for the role configuration, and the record copy the 对局记录
 * overlay renders for the lady checks and the rounds. Seat medals and
 * identity words wear their seat's side. A finished game missing a fact
 * it must have throws.
 */

import {
  AVALON_LADY_MIN_PLAYERS,
  AVALON_LADY_ROUNDS,
  type AvalonEndReason,
  type AvalonProposalRecordView,
  type AvalonQuestRecord,
  type AvalonRoleId,
  type AvalonRoundRecordView,
  type AvalonSeatView,
  type AvalonViewModel,
  isAvalonEvilRole,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';

import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type {
  ReviewBlock,
  ReviewGroup,
  ReviewGroupRow,
  ReviewInline,
  ReviewLabeledValue,
  ReviewRosterRow,
  ReviewTimelineStep,
  ReviewTone,
  RoomReviewDocument,
} from '@/features/room/review/types';

import { getAvalonFactionDisplayName, getAvalonRoleDisplayName } from '../model/avalonRoleDisplay';
import {
  AVALON_INTERRUPTED_LABEL,
  AVALON_INTERRUPTED_NOTE,
  AVALON_QUEST_CARD_LABELS,
  AVALON_QUEST_RESULT_LABELS,
  AVALON_VETO_ENDED_LABEL,
  formatAvalonLadyCheck,
  formatAvalonLadyHandover,
  formatAvalonLadySkipped,
  formatAvalonQuestSizes,
  formatAvalonVetoEndedNote,
  formatAvalonVoteMode,
  formatAvalonVoteTally,
} from '../room/avalonRecordCopy';
import { createAvalonBoardInfoSections } from '../room/avalonRoomAdapter';
import {
  AVALON_END_REASON_COPY,
  formatAvalonQuestLabel,
  resolveEndedInstruction,
} from '../room/policy/avalonInteractionPolicy';

const IDENTITIES_TITLE = '全员身份';
const CONFIG_TITLE = '本局配置';
const LADY_TITLE = '湖仙查验';
const QUESTS_TITLE = '任务进程';
const VETO_STAT_LABEL = '否决';
const TEAM_VERB = '组队';
const APPROVED_TAG = '通过';
const REJECTED_TAG = '否决';

type TextInline = Extract<ReviewInline, { readonly kind: 'text' }>;

/** Every seated player's revealed role, by seat. */
type RoleIndex = ReadonlyMap<number, AvalonRoleId>;

function plain(text: string): TextInline {
  return { kind: 'text', text, tone: 'neutral' };
}

/** Avalon's two sides are the report's good / evil tones. */
function sideTone(role: AvalonRoleId): ReviewTone {
  return isAvalonEvilRole(role) ? 'evil' : 'good';
}

function revealedRoles(seats: readonly AvalonSeatView[]): RoleIndex {
  return new Map(
    seats.map((seatView): readonly [number, AvalonRoleId] => {
      if (seatView.role === null) {
        throw new Error(`[FAIL-FAST] Avalon review seat ${seatView.seat} has no revealed role`);
      }
      return [seatView.seat, seatView.role];
    }),
  );
}

function roleAt(seat: number, roles: RoleIndex): AvalonRoleId {
  const role = roles.get(seat);
  if (role === undefined) {
    throw new Error(`[FAIL-FAST] Avalon review names seat ${seat} with no revealed role`);
  }
  return role;
}

function seatOfRole(role: AvalonRoleId, roles: RoleIndex): number {
  for (const [seat, candidate] of roles) {
    if (candidate === role) return seat;
  }
  throw new Error(`[FAIL-FAST] Avalon review has no ${role} seat`);
}

function seatInline(seat: number, roles: RoleIndex): ReviewInline {
  return { kind: 'seat', seat, tone: sideTone(roleAt(seat, roles)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verdict, score and identities
// ─────────────────────────────────────────────────────────────────────────────

/** The assassin's accusation: 刺客 5 号指认 1 号（梅林）→ 命中. */
function accusationLine(reason: AvalonEndReason, accusedSeat: number, roles: RoleIndex): string {
  const assassinSeat = seatOfRole('assassin', roles);
  const accusedRole = getAvalonRoleDisplayName(roleAt(accusedSeat, roles));
  const isHit = reason === 'assassinationHit' || reason === 'earlyAssassinationHit';
  return `刺客 ${assassinSeat + 1} 号指认 ${accusedSeat + 1} 号（${accusedRole}）→ ${isHit ? '命中' : '未命中'}`;
}

function heroBlock(viewModel: AvalonViewModel, roles: RoleIndex): ReviewBlock {
  const { winner, reason, accusedSeat } = resolveEndedInstruction(viewModel);
  const copy = AVALON_END_REASON_COPY[reason];
  return {
    kind: 'hero',
    headline: [{ kind: 'text', text: copy.title }],
    tone: winner,
    stamps: [],
    byline: accusedSeat === null ? copy.description : accusationLine(reason, accusedSeat, roles),
  };
}

function statsBlock(viewModel: AvalonViewModel): ReviewBlock {
  const settled = (result: AvalonQuestRecord['result']) =>
    viewModel.questResults.filter((candidate) => candidate === result).length;
  const vetoes = viewModel.roundHistory.reduce(
    (total, record) => total + record.proposals.filter((proposal) => !proposal.approved).length,
    0,
  );
  return {
    kind: 'stats',
    items: [
      { label: AVALON_QUEST_RESULT_LABELS.success, value: String(settled('success')) },
      { label: AVALON_QUEST_RESULT_LABELS.fail, value: String(settled('fail')) },
      { label: VETO_STAT_LABEL, value: String(vetoes) },
    ],
  };
}

/** The role under the name, the side as the status: nobody leaves an Avalon table. */
function rosterRow(seatView: AvalonSeatView, roles: RoleIndex): ReviewRosterRow {
  const role = roleAt(seatView.seat, roles);
  const tone = sideTone(role);
  return {
    seat: seatView.seat,
    seatTone: tone,
    name: seatView.displayName,
    role: getAvalonRoleDisplayName(role),
    status: getAvalonFactionDisplayName(role),
    statusTone: tone,
    isOut: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration and the lady of the lake
// ─────────────────────────────────────────────────────────────────────────────

function configFacts(viewModel: AvalonViewModel, hasLady: boolean): readonly ReviewLabeledValue[] {
  const { playerCount } = viewModel;
  const boardSections = createAvalonBoardInfoSections(playerCount);
  if (boardSections === null || !isAvalonPlayerCount(playerCount)) {
    throw new Error(`[FAIL-FAST] Avalon review has no board for ${playerCount} players`);
  }
  return [
    { label: '投票', value: formatAvalonVoteMode(viewModel.voteMode) },
    { label: '否决上限', value: String(viewModel.vetoLimit) },
    { label: '任务人数', value: formatAvalonQuestSizes(playerCount) },
    { label: '湖仙', value: hasLady ? '启用' : '不启用' },
    ...boardSections.map((section) => ({
      label: section.title,
      value: section.items
        .map((item) => `${item.displayName}${item.count > 1 ? ` ×${item.count}` : ''}`)
        .join('、'),
    })),
  ];
}

/**
 * One step per lady round: the completed check with its result — every
 * identity is public in the review — or why it never happened.
 */
function ladySteps(viewModel: AvalonViewModel, roles: RoleIndex): readonly ReviewTimelineStep[] {
  return AVALON_LADY_ROUNDS.map((round): ReviewTimelineStep => {
    const title = formatAvalonQuestLabel(round);
    const check = viewModel.ladyHistory.find((record) => record.afterRound === round);
    if (check === undefined) {
      const record = viewModel.roundHistory.find((candidate) => candidate.round === round);
      return { title, tone: 'muted', lines: [[plain(formatAvalonLadySkipped(record))]] };
    }
    const targetRole = roleAt(check.targetSeat, roles);
    const tone = sideTone(targetRole);
    return {
      title,
      tone,
      lines: [
        [
          plain(`${formatAvalonLadyCheck(check)}（`),
          { kind: 'text', text: getAvalonFactionDisplayName(targetRole), tone },
          plain('）'),
        ],
        [plain(formatAvalonLadyHandover(check))],
      ],
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Quest process
// ─────────────────────────────────────────────────────────────────────────────

/** One proposal: the leader's medal, the team's medals, the tally and the verdict. */
function proposalRow(proposal: AvalonProposalRecordView, roles: RoleIndex): ReviewGroupRow {
  return {
    cells: [
      seatInline(proposal.leaderSeat, roles),
      plain(TEAM_VERB),
      ...proposal.teamSeats.map((seat) => seatInline(seat, roles)),
      plain(formatAvalonVoteTally(proposal)),
      proposal.approved
        ? { kind: 'tag', text: APPROVED_TAG, tone: 'good' }
        : { kind: 'tag', text: REJECTED_TAG, tone: 'muted' },
    ],
    isDimmed: !proposal.approved,
  };
}

function questCards(quest: AvalonQuestRecord): string {
  const { success, fail } = AVALON_QUEST_CARD_LABELS;
  return `${success} ×${quest.successCount} · ${fail} ×${quest.failCount}`;
}

/** A started quest: how it closed as rail, tag and footnote; its proposals as rows. */
function questGroup(record: AvalonRoundRecordView, roles: RoleIndex): ReviewGroup {
  const title = formatAvalonQuestLabel(record.round);
  const rows = record.proposals.map((proposal) => proposalRow(proposal, roles));
  const { quest } = record;
  if (quest !== null) {
    const isSuccess = quest.result === 'success';
    return {
      title,
      railTone: isSuccess ? 'good' : 'evil',
      tag: isSuccess
        ? { text: AVALON_QUEST_RESULT_LABELS.success, tone: 'good' }
        : { text: `${AVALON_QUEST_RESULT_LABELS.fail} ×${quest.failCount}`, tone: 'evil' },
      rows,
      footnote: questCards(quest),
    };
  }
  if (record.vetoEnded) {
    return {
      title,
      railTone: 'evil',
      tag: { text: AVALON_VETO_ENDED_LABEL, tone: 'evil' },
      rows,
      footnote: formatAvalonVetoEndedNote(record.proposals.length),
    };
  }
  return {
    title,
    railTone: 'muted',
    tag: { text: AVALON_INTERRUPTED_LABEL, tone: 'muted' },
    rows,
    footnote: AVALON_INTERRUPTED_NOTE,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The review of an ended game. `gameSequence` is already the 1-based game
 * number: the engine counts it up at every deal.
 */
export function toAvalonReviewDocument(input: {
  readonly viewModel: AvalonViewModel;
  readonly roomCode: string;
  readonly gameSequence: number;
}): RoomReviewDocument {
  const { viewModel, roomCode, gameSequence } = input;
  const roles = revealedRoles(viewModel.seats);
  const hasLady = viewModel.playerCount >= AVALON_LADY_MIN_PLAYERS;
  const blocks: ReviewBlock[] = [
    heroBlock(viewModel, roles),
    statsBlock(viewModel),
    { kind: 'section', title: IDENTITIES_TITLE },
    {
      kind: 'roster',
      columns: 1,
      rows: viewModel.seats.map((seatView) => rosterRow(seatView, roles)),
    },
    { kind: 'section', title: CONFIG_TITLE },
    { kind: 'facts', items: configFacts(viewModel, hasLady) },
  ];
  if (hasLady) {
    blocks.push(
      { kind: 'section', title: LADY_TITLE },
      { kind: 'timeline', steps: ladySteps(viewModel, roles) },
    );
  }
  // An assassin who strikes before the first vote settles leaves no quest to show.
  if (viewModel.roundHistory.length > 0) {
    blocks.push(
      { kind: 'section', title: QUESTS_TITLE },
      { kind: 'groups', groups: viewModel.roundHistory.map((record) => questGroup(record, roles)) },
    );
  }
  return {
    roundKey: `game-${gameSequence}`,
    kicker: `🏰 第 ${gameSequence} 局 · 终局`,
    fileStem: `avalon-${roomCode}-${gameSequence}`,
    footer: REVIEW_GENERATED_FOOTER,
    isAborted: false,
    pages: [{ key: 'ended', label: null, blocks }],
  };
}
