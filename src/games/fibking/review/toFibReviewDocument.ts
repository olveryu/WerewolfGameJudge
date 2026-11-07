/**
 * The FibKing review document: the round's word with whether 大聪明 found
 * 老实人, the true definition, everyone's identity, and 大聪明's picks in
 * order. A round ends on the pick that names 老实人 or on the host's
 * reveal, so 老实人 among the picks means exactly that 大聪明 found them.
 */

import {
  type FibRole,
  type FibRound,
  type FibState,
  getFibRole,
} from '@game-judge/game-engine/games/fibking/public';

import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type {
  ReviewBlock,
  ReviewRosterRow,
  ReviewTimelineStep,
  ReviewTone,
  RoomReviewDocument,
} from '@/features/room/review/types';

import { FIB_DEFINITION_LABELS, getFibRoleName } from '../room/fibRoomAdapter';

// The state carries no round ordinal, so the kicker names the round 本局.
const KICKER = '💡 本局 · 终局';
const PAGE_KEY = 'round';
const IDENTITIES_TITLE = '全员身份';
const PICKS_TITLE = '点选记录';
const NOT_PICKED = '未被选中';

const ROLE_TONES: Readonly<Record<FibRole, ReviewTone>> = {
  guesser: 'highlight',
  honest: 'good',
  fibber: 'evil',
};

/** The facts of one ended round. */
export interface FibReviewInput {
  readonly round: FibRound;
  readonly numberOfPlayers: FibState['numberOfPlayers'];
  readonly roster: FibState['roster'];
  readonly roomCode: string;
}

type Pick = FibRound['guesses'][number];

/** The caption of the pick at a 0-based index: 第 k 个被选中. */
function pickCaption(index: number): string {
  return `第 ${index + 1} 个被选中`;
}

function outcomeLine(round: FibRound): string {
  const guesser = getFibRoleName('guesser');
  return round.guesses.some((pick) => pick.seat === round.roles.honestSeat)
    ? `${guesser}选中了${getFibRoleName('honest')}`
    : `${guesser}被${getFibRoleName('fibber')}骗过`;
}

function seatName(roster: FibState['roster'], seat: number): string {
  const target = getRoomProfileTarget(roster, seat);
  if (target === null) {
    throw new Error(`[FAIL-FAST] FibKing review seat ${seat} holds no player`);
  }
  return target.rosterName;
}

function rosterRows(input: FibReviewInput): readonly ReviewRosterRow[] {
  const { round, numberOfPlayers, roster } = input;
  return Array.from({ length: numberOfPlayers }, (_, seat) => {
    const role = getFibRole(round.roles, seat);
    const order = round.guesses.findIndex((pick) => pick.seat === seat);
    return {
      seat,
      seatTone: ROLE_TONES[role],
      name: seatName(roster, seat),
      role: getFibRoleName(role),
      status: order < 0 ? NOT_PICKED : pickCaption(order),
      statusTone: order < 0 ? 'muted' : ROLE_TONES[role],
      isOut: false,
    };
  });
}

function pickStep(pick: Pick): ReviewTimelineStep {
  const tone = ROLE_TONES[pick.role];
  return {
    title: null,
    tone,
    lines: [
      [
        { kind: 'seat', seat: pick.seat, tone },
        { kind: 'tag', text: getFibRoleName(pick.role), tone },
      ],
    ],
  };
}

/** The one-page review of an ended round. */
export function toFibReviewDocument(input: FibReviewInput): RoomReviewDocument {
  const { round, roomCode } = input;
  const blocks: ReviewBlock[] = [
    {
      kind: 'hero',
      headline: [{ kind: 'text', text: round.word }],
      tone: 'neutral',
      stamps: [],
      byline: outcomeLine(round),
    },
    {
      kind: 'facts',
      items: [
        { label: FIB_DEFINITION_LABELS.coreMeaning, value: round.definition.coreMeaning },
        { label: FIB_DEFINITION_LABELS.usageNote, value: round.definition.usageNote },
      ],
    },
    { kind: 'section', title: IDENTITIES_TITLE },
    { kind: 'roster', columns: 1, rows: rosterRows(input) },
  ];
  if (round.guesses.length > 0) {
    blocks.push(
      { kind: 'section', title: PICKS_TITLE },
      { kind: 'timeline', steps: round.guesses.map(pickStep) },
    );
  }
  return {
    roundKey: round.roundId,
    kicker: KICKER,
    fileStem: `fibking-${roomCode}`,
    footer: REVIEW_GENERATED_FOOTER,
    isAborted: false,
    pages: [{ key: PAGE_KEY, label: null, blocks }],
  };
}
