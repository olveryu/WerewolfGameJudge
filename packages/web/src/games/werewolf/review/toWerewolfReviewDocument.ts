/**
 * The werewolf review document: the first night's report, the sheriff
 * election record when one was held, and the identity wall.
 *
 * Every sentence of the night comes from the engine's night review
 * (`getWerewolfNightReview`); this module only lays the sentences out and
 * gives them semantic tones: the actor's seat and role in the body tone,
 * what they did in the actor's faction tone, a dead seat number in that
 * player's faction tone.
 */

import type {
  DeathReason,
  GameState,
  NightReviewDeath,
  NightReviewIdentityEntry,
  NightReviewSheriffSection,
  RoleId,
  WerewolfNightReview,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  Faction,
  getRoleDisplayName,
  ROLE_SPECS,
} from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { formatPendingSeats } from '@/features/room/components/PendingSeatsRow';
import type {
  ReviewBlock,
  ReviewInline,
  ReviewRosterRow,
  ReviewStamp,
  ReviewTimelineStep,
  ReviewTone,
  RoomReviewDocument,
} from '@/features/room/review/types';
import { createSheriffElectionPresentationFromSection } from '@/games/werewolf/room/day/sheriffElectionPresentation';
import { DEATH_REASON_LABELS } from '@/games/werewolf/room/NightReview.helpers';

const KICKER = '🌙 第一夜 · 夜报';
const FOOTER = '仅供裁判及观战者参考 · 本夜报由对局记录自动生成';
const TIMELINE_TITLE = '第一夜';
const SHERIFF_TITLE = '警长竞选';
const IDENTITIES_TITLE = '全员身份';
const PEACEFUL_HEADLINE = '昨夜平安夜';
const ROSTER_ALIVE = '存活';
const ROSTER_OUT = '已出局';
const DEATH_CAUSE_SUFFIX = '出局';

type TextInline = Extract<ReviewInline, { readonly kind: 'text' }>;

function plain(text: string): TextInline {
  return { kind: 'text', text, tone: 'neutral' };
}

function toned(text: string, tone: ReviewTone): TextInline {
  return { kind: 'text', text, tone };
}

function seatInline(seat: number, tone: ReviewTone): ReviewInline {
  return { kind: 'seat', seat, tone };
}

function tagInline(text: string, tone: ReviewTone): ReviewInline {
  return { kind: 'tag', text, tone };
}

/** The one faction-tone rule: a role's faction names its tone in running text. */
function factionTone(roleId: RoleId): ReviewTone {
  switch (ROLE_SPECS[roleId].faction) {
    case Faction.Wolf:
      return 'evil';
    case Faction.God:
      return 'special';
    case Faction.Villager:
      return 'good';
    case Faction.Special:
      return 'highlight';
  }
}

/** A seat medal's tone: the three main factions; third parties and unknowns stay neutral. */
function medalTone(roleId: RoleId | null): ReviewTone {
  if (roleId === null) return 'neutral';
  const tone = factionTone(roleId);
  return tone === 'highlight' ? 'neutral' : tone;
}

function identityRoleText(entry: NightReviewIdentityEntry): string {
  if (entry.isEmptySeat) return '空座';
  return entry.roleId === null ? '未分配' : getRoleDisplayName(entry.roleId);
}

/** 狼杀出局 for a recorded reason, the bare 出局 for a death with none. */
function deathCause(reason: DeathReason | null): string {
  return reason === null
    ? DEATH_CAUSE_SUFFIX
    : `${DEATH_REASON_LABELS[reason]}${DEATH_CAUSE_SUFFIX}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Night timeline sentences
// ─────────────────────────────────────────────────────────────────────────────

type IdentityIndex = ReadonlyMap<number, NightReviewIdentityEntry>;

function identityForSeat(seat: number, identities: IdentityIndex): NightReviewIdentityEntry {
  const identity = identities.get(seat);
  if (identity === undefined) {
    throw new Error(`[FAIL-FAST] Night review names seat ${seat} with no identity entry`);
  }
  return identity;
}

function bottomCardsSentence(roleIds: readonly RoleId[]): readonly TextInline[] {
  return [
    plain('底牌：'),
    ...roleIds.flatMap((roleId, index) => [
      ...(index > 0 ? [plain('、')] : []),
      toned(getRoleDisplayName(roleId), factionTone(roleId)),
    ]),
    plain('。'),
  ];
}

function deathsSentence(
  deaths: readonly NightReviewDeath[],
  identities: IdentityIndex,
): readonly TextInline[] {
  if (deaths.length === 0) return [plain('本夜无人出局。')];
  const inlines: TextInline[] = [];
  deaths.forEach((death, index) => {
    if (index > 0) inlines.push(plain(index === deaths.length - 1 ? '和' : '、'));
    const { roleId } = identityForSeat(death.seat, identities);
    inlines.push(
      roleId === null
        ? plain(formatSeat(death.seat))
        : toned(formatSeat(death.seat), factionTone(roleId)),
    );
  });
  inlines.push(plain('出局。'));
  return inlines;
}

/** The night as sentences: bottom cards, every engine line in order, then who is out. */
function nightSentences(
  review: WerewolfNightReview,
  identities: IdentityIndex,
): readonly (readonly TextInline[])[] {
  return [
    ...(review.bottomCards.length === 0 ? [] : [bottomCardsSentence(review.bottomCards)]),
    ...review.lines.map((line) =>
      line.kind === 'explanation'
        ? [plain(`${line.text}。`)]
        : [
            plain(`${formatSeat(line.seat)}${line.subject}`),
            toned(line.phrase, factionTone(line.roleId)),
            plain(`${line.result ?? ''}。`),
          ],
    ),
    deathsSentence(review.deaths, identities),
  ];
}

/**
 * The public election record as timeline steps. Registration is
 * status-only (no seats, no counts, for anyone); an open vote shows
 * submission counts only, never a ballot.
 *
 * This is a mechanical translator over the presentation projection: it
 * branches only on the projection row kind and its semantic flags, never
 * on an election phase, result, or seat set. Which rows exist, in which
 * order, and who is marked winner is decided once in the projection;
 * this function only turns a row into the timeline's vocabulary (seat
 * medals, the [当选] tag, tones).
 */
function sheriffSteps(section: NightReviewSheriffSection): readonly ReviewTimelineStep[] {
  return createSheriffElectionPresentationFromSection(section).rows.flatMap(
    (row): readonly ReviewTimelineStep[] => {
      switch (row.kind) {
        case 'phase':
          return [{ title: row.title, tone: 'neutral', lines: [[plain(row.description)]] }];
        case 'result': {
          if (row.resultKind === 'elected') {
            if (row.sheriffSeat === null || row.bannerSubtitle === null) {
              throw new Error(
                '[FAIL-FAST] Sheriff election presentation has an elected result without a sheriff or an elected line',
              );
            }
            return [
              {
                title: row.timelineTitle,
                tone: 'highlight',
                lines: [[seatInline(row.sheriffSeat, 'highlight'), plain(row.bannerSubtitle)]],
              },
            ];
          }
          if (row.noSheriffText === null) {
            throw new Error(
              '[FAIL-FAST] Sheriff election presentation has a no-sheriff result without a reason',
            );
          }
          return [{ title: row.timelineTitle, tone: 'muted', lines: [[plain(row.noSheriffText)]] }];
        }
        case 'registration': {
          const lines: (readonly ReviewInline[])[] = [
            row.seats.length === 0
              ? [plain('无')]
              : row.seats.map(({ seat, isWithdrawn }) =>
                  seatInline(seat, isWithdrawn ? 'muted' : 'neutral'),
                ),
          ];
          if (row.withdrawnNote !== null) lines.push([plain(row.withdrawnNote)]);
          return [{ title: '上警', tone: 'neutral', lines }];
        }
        case 'candidates':
          return [
            {
              title: row.label,
              tone: 'neutral',
              lines: [row.seats.map((seat) => seatInline(seat, 'neutral'))],
            },
          ];
        case 'speaking':
          return [{ title: '发言顺序', tone: 'neutral', lines: [[plain(row.text)]] }];
        case 'voteProgress': {
          const lines: (readonly ReviewInline[])[] = [[plain(row.text)]];
          if (row.pendingSeats.length > 0) {
            lines.push([plain(formatPendingSeats('未投票', row.pendingSeats))]);
          }
          return [{ title: '投票进度', tone: 'neutral', lines }];
        }
        case 'round': {
          const lines: (readonly ReviewInline[])[] = row.candidates.map((candidate) => [
            seatInline(candidate.seat, candidate.isWinner ? 'highlight' : 'neutral'),
            plain(`${candidate.votes} 票${candidate.voterSeats.length > 0 ? '：' : ''}`),
            ...candidate.voterSeats.map((seat) => seatInline(seat, 'neutral')),
            ...(candidate.isWinner ? [tagInline('当选', 'highlight')] : []),
          ]);
          if (row.abstainingSeats.length > 0) {
            lines.push([
              plain('弃票：'),
              ...row.abstainingSeats.map((seat) => seatInline(seat, 'muted')),
            ]);
          }
          if (row.isEmpty) lines.push([plain('无投票人')]);
          return [{ title: row.title, tone: 'neutral', lines }];
        }
      }
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────

function heroBlock(review: WerewolfNightReview, identities: IdentityIndex): ReviewBlock {
  if (review.deaths.length === 0) {
    return {
      kind: 'hero',
      headline: [{ kind: 'text', text: PEACEFUL_HEADLINE }],
      tone: 'neutral',
      stamps: [],
      byline: null,
    };
  }
  const stamps: ReviewStamp[] = review.deaths.map((death) => {
    const { note } = death;
    return {
      seat: death.seat,
      tone: 'out',
      title: identityRoleText(identityForSeat(death.seat, identities)),
      caption: deathCause(death.reason),
      note:
        note === null
          ? null
          : note.kind === 'wolfVotes'
            ? `狼队 ${note.votes} 票锁定`
            : `${getRoleDisplayName(note.actorRoleId)}下毒`,
    };
  });
  return {
    kind: 'hero',
    headline: [
      { kind: 'text', text: '昨夜 ' },
      { kind: 'figure', text: String(review.deaths.length), tone: 'out' },
      { kind: 'text', text: ' 人出局' },
    ],
    tone: 'neutral',
    stamps,
    byline: null,
  };
}

function rosterRows(review: WerewolfNightReview): readonly ReviewRosterRow[] {
  const reasonBySeat = new Map<number, DeathReason | null>(
    review.deaths.map((death) => [death.seat, death.reason]),
  );
  return review.identities.map((entry) => {
    const isOut = !entry.isAlive;
    // A seat out with no recorded reason reads 已出局, never a bare 出局.
    const reason = reasonBySeat.get(entry.seat) ?? null;
    return {
      seat: entry.seat,
      seatTone: isOut ? 'out' : medalTone(entry.roleId),
      name: null,
      role: identityRoleText(entry),
      status: !isOut ? ROSTER_ALIVE : reason === null ? ROSTER_OUT : deathCause(reason),
      statusTone: isOut ? 'out' : 'muted',
      isOut,
    };
  });
}

export function toWerewolfReviewDocument(input: {
  readonly review: WerewolfNightReview;
  readonly roomCode: string;
  readonly gameSequence: GameState['gameSequence'];
}): RoomReviewDocument {
  const { review, roomCode, gameSequence } = input;
  const identities: IdentityIndex = new Map(review.identities.map((entry) => [entry.seat, entry]));
  const blocks: ReviewBlock[] = [
    heroBlock(review, identities),
    { kind: 'section', title: TIMELINE_TITLE },
    {
      kind: 'timeline',
      steps: nightSentences(review, identities).map((sentence) => ({
        title: null,
        tone: 'neutral',
        lines: [sentence],
      })),
    },
  ];
  if (review.sheriff !== undefined) {
    blocks.push(
      { kind: 'section', title: SHERIFF_TITLE },
      { kind: 'timeline', steps: sheriffSteps(review.sheriff) },
    );
  }
  blocks.push(
    { kind: 'divider' },
    { kind: 'section', title: IDENTITIES_TITLE },
    { kind: 'roster', columns: 2, rows: rosterRows(review) },
  );
  return {
    roundKey: `game-${gameSequence}`,
    kicker: KICKER,
    fileStem: `werewolf-${roomCode}-${gameSequence + 1}`,
    footer: FOOTER,
    pages: [{ key: 'night-1', label: null, blocks }],
  };
}
