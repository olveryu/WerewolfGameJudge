/**
 * The undercover review document: how the round concluded, its facts, the
 * identity wall and the elimination order. An aborted round shows only
 * what play made public — the eliminated seats and their roles — never the
 * words or an unrevealed identity, as the abort itself promised.
 */

import {
  UNDERCOVER_CATEGORY_NAMES,
  UNDERCOVER_CONFIG_SCHEMA,
  UNDERCOVER_ROLE_NAMES,
  type UndercoverConfig,
  type UndercoverRole,
  type UndercoverRound,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import type { AnyConfigFieldSpec } from '@game-judge/game-engine/platform/config/configSchema';

import { getRoomProfileTarget } from '@/features/room/model/getRoomProfileTarget';
import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type {
  ReviewBlock,
  ReviewLabeledValue,
  ReviewRosterRow,
  ReviewStamp,
  ReviewTimelineStep,
  ReviewTone,
  RoomReviewDocument,
} from '@/features/room/review/types';

import {
  formatUndercoverBlankMode,
  UNDERCOVER_ABORT_NOTICE,
  UNDERCOVER_ABORTED_TEXT,
} from '../room/undercoverCopy';

// The state carries no round ordinal, so the kicker names the round 本局.
const KICKER = '🕵️ 本局 · 终局';
const PAGE_KEY = 'round';
const CIVILIAN_WORD_LABEL = '平民词';
const UNDERCOVER_WORD_LABEL = '卧底词';
const IDENTITIES_TITLE = '全员身份';
const ELIMINATIONS_TITLE = '出局顺序';
const ROSTER_ALIVE = '存活';

const ROLE_TONES: Readonly<Record<UndercoverRole, ReviewTone>> = {
  civilian: 'good',
  undercover: 'evil',
  blank: 'special',
};

/** How the reviewed round concluded: a side won, or the host aborted it. */
export type UndercoverRoundConclusion =
  | { readonly kind: 'won'; readonly winner: UndercoverRole }
  | { readonly kind: 'aborted' };

/** The facts of one concluded round. */
export interface UndercoverReviewInput {
  readonly round: UndercoverRound;
  readonly conclusion: UndercoverRoundConclusion;
  readonly config: UndercoverConfig;
  readonly roster: UndercoverState['roster'];
  readonly roomCode: string;
}

type Revelation = UndercoverRound['revelations'][number];

/** The caption of the revelation at a 0-based index: 第 k 个出局. */
function eliminationCaption(index: number): string {
  return `第 ${index + 1} 个出局`;
}

function seatName(roster: UndercoverState['roster'], seat: number): string {
  const target = getRoomProfileTarget(roster, seat);
  if (target === null) {
    throw new Error(`[FAIL-FAST] Undercover review seat ${seat} holds no player`);
  }
  return target.rosterName;
}

function heroBlock(round: UndercoverRound, conclusion: UndercoverRoundConclusion): ReviewBlock {
  const stamps: ReviewStamp[] = round.revelations.map((revelation, index) => ({
    seat: revelation.seat,
    tone: 'out',
    title: UNDERCOVER_ROLE_NAMES[revelation.role],
    caption: eliminationCaption(index),
    note: null,
  }));
  return conclusion.kind === 'won'
    ? {
        kind: 'hero',
        headline: [{ kind: 'text', text: `${UNDERCOVER_ROLE_NAMES[conclusion.winner]}获胜` }],
        tone: ROLE_TONES[conclusion.winner],
        stamps,
        byline: null,
      }
    : {
        kind: 'hero',
        headline: [{ kind: 'text', text: UNDERCOVER_ABORTED_TEXT }],
        tone: 'neutral',
        stamps,
        byline: UNDERCOVER_ABORT_NOTICE,
      };
}

/**
 * The words and the drawn pair's category once the round was won; an
 * aborted round keeps both undisclosed and states its configured category.
 * Setting facts carry the settings' own labels.
 */
function factItems(input: UndercoverReviewInput): readonly ReviewLabeledValue[] {
  const { round, conclusion, config } = input;
  const { fields } = UNDERCOVER_CONFIG_SCHEMA;
  const categoryLabel = settingLabel(fields.category);
  const blankMode = {
    label: settingLabel(fields.hasBlank),
    value: formatUndercoverBlankMode(config.hasBlank),
  };
  if (conclusion.kind === 'aborted') {
    return [{ label: categoryLabel, value: UNDERCOVER_CATEGORY_NAMES[config.category] }, blankMode];
  }
  return [
    { label: CIVILIAN_WORD_LABEL, value: round.civilianWord },
    { label: UNDERCOVER_WORD_LABEL, value: round.undercoverWord },
    { label: categoryLabel, value: UNDERCOVER_CATEGORY_NAMES[round.wordPair.category] },
    blankMode,
  ];
}

function settingLabel(spec: AnyConfigFieldSpec): string {
  if (spec.kind === 'fixed') {
    throw new Error('[FAIL-FAST] Undercover review states a setting the room cannot change');
  }
  return spec.label;
}

function rosterRows(
  round: UndercoverRound,
  roster: UndercoverState['roster'],
): readonly ReviewRosterRow[] {
  return round.roles.map((role, seat) => {
    const order = round.revelations.findIndex((revelation) => revelation.seat === seat);
    const isOut = order >= 0;
    return {
      seat,
      seatTone: isOut ? 'out' : ROLE_TONES[role],
      name: seatName(roster, seat),
      role: UNDERCOVER_ROLE_NAMES[role],
      status: isOut ? eliminationCaption(order) : ROSTER_ALIVE,
      statusTone: isOut ? 'out' : 'muted',
      isOut,
    };
  });
}

function eliminationStep(revelation: Revelation): ReviewTimelineStep {
  const tone = ROLE_TONES[revelation.role];
  return {
    title: null,
    tone,
    lines: [
      [
        { kind: 'seat', seat: revelation.seat, tone: 'out' },
        { kind: 'tag', text: UNDERCOVER_ROLE_NAMES[revelation.role], tone },
      ],
    ],
  };
}

/** The one-page review of a won or aborted round. */
export function toUndercoverReviewDocument(input: UndercoverReviewInput): RoomReviewDocument {
  const { round, conclusion, roster, roomCode } = input;
  const blocks: ReviewBlock[] = [
    heroBlock(round, conclusion),
    { kind: 'facts', items: factItems(input) },
  ];
  if (conclusion.kind === 'won') {
    blocks.push(
      { kind: 'section', title: IDENTITIES_TITLE },
      { kind: 'roster', columns: 1, rows: rosterRows(round, roster) },
    );
  }
  if (round.revelations.length > 0) {
    blocks.push(
      { kind: 'section', title: ELIMINATIONS_TITLE },
      { kind: 'timeline', steps: round.revelations.map(eliminationStep) },
    );
  }
  return {
    roundKey: round.roundId,
    kicker: KICKER,
    fileStem: `undercover-${roomCode}`,
    footer: REVIEW_GENERATED_FOOTER,
    isAborted: conclusion.kind === 'aborted',
    pages: [{ key: PAGE_KEY, label: null, blocks }],
  };
}
