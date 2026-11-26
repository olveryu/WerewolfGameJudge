/**
 * Builds a shareable report from Decrypto's ended, public state.
 */

import {
  DECRYPTO_GAME_TYPE,
  DECRYPTO_TEAMS,
  type DecryptoGame,
  type DecryptoState,
  type DecryptoTeam,
  getDecryptoViewModel,
} from '@game-judge/game-engine/games/decrypto/public';

import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type {
  ReviewInline,
  ReviewRosterRow,
  ReviewTimelineStep,
  ReviewTone,
  RoomReviewDocument,
} from '@/features/room/review/types';

const TEAM_NAMES: Readonly<Record<DecryptoTeam, string>> = {
  blue: '蓝队',
  purple: '紫队',
};

function outcomeText(outcome: NonNullable<DecryptoGame['outcome']>): string {
  return outcome === 'shared' ? '平局加赛后共同获胜' : `${TEAM_NAMES[outcome]}获胜`;
}

function teamTone(team: DecryptoTeam): ReviewTone {
  return team === 'blue' ? 'good' : 'special';
}

function participantRows(state: DecryptoState, game: DecryptoGame): readonly ReviewRosterRow[] {
  const seats = getDecryptoViewModel(state, null).seats;
  return seats.map((seat) => {
    const team = game.assignments[seat.seat];
    if (team === undefined)
      throw new Error(`Decrypto review is missing team for seat ${seat.seat}`);
    const won = game.outcome === 'shared' || game.outcome === team;
    return {
      seat: seat.seat,
      seatTone: teamTone(team),
      name: seat.displayName,
      role: TEAM_NAMES[team],
      status: won ? (game.outcome === 'shared' ? '共同获胜' : '获胜') : '未获胜',
      statusTone: won ? 'good' : 'muted',
      isOut: false,
    };
  });
}

function guessLine(
  label: string,
  guess: readonly number[] | null,
  code: readonly number[],
): ReviewInline[] {
  if (guess === null) return [{ kind: 'text', text: `${label}：本轮未进行`, tone: 'muted' }];
  const correct = guess.every((value, index) => value === code[index]);
  return [
    { kind: 'text', text: `${label}：`, tone: 'neutral' },
    {
      kind: 'tag',
      text: `${guess.join(' – ')}（正确编号 ${code.join(' – ')}）`,
      tone: correct ? 'good' : 'evil',
    },
  ];
}

function roundTimeline(game: DecryptoGame): ReviewTimelineStep[] {
  const rounds = [...new Set(game.history.blue.map(({ round }) => round))];
  return rounds.map((round) => {
    const lines: ReviewInline[][] = [];
    for (const team of DECRYPTO_TEAMS) {
      const entry = game.history[team].find((item) => item.round === round);
      if (entry === undefined) throw new Error(`Decrypto review is missing ${team} round ${round}`);
      lines.push([
        {
          kind: 'text',
          text: `${TEAM_NAMES[team]}线索：${entry.clues.join(' / ')}`,
          tone: teamTone(team),
        },
      ]);
      lines.push(guessLine(`${TEAM_NAMES[team]}解码`, entry.decode, entry.code));
      if (entry.intercept !== null)
        lines.push(guessLine(`${TEAM_NAMES[team]}被拦截`, entry.intercept, entry.code));
    }
    return {
      title: `第 ${round} 轮`,
      tone: 'neutral',
      lines,
    };
  });
}

function tiebreakTimeline(game: DecryptoGame): ReviewTimelineStep | null {
  if (game.tiebreakGuesses.blue === null || game.tiebreakGuesses.purple === null) return null;
  const lines = DECRYPTO_TEAMS.map((team): ReviewInline[] => {
    const guesses = game.tiebreakGuesses[team];
    const judgements = game.tiebreakJudgements[team];
    if (guesses === null || judgements === null)
      throw new Error(`Decrypto review is missing ${team} tiebreak judgements`);
    const correctCount = judgements.filter(Boolean).length;
    return [
      { kind: 'text', text: `${TEAM_NAMES[team]}：${guesses.join('、')} · `, tone: teamTone(team) },
      { kind: 'tag', text: `${correctCount} / ${guesses.length} 判定正确`, tone: teamTone(team) },
    ];
  });
  return { title: '平局加赛', tone: 'highlight', lines };
}

function scoreItems(game: DecryptoGame) {
  return DECRYPTO_TEAMS.flatMap((team) => [
    { label: `${TEAM_NAMES[team]}拦截`, value: String(game.interceptions[team]) },
    { label: `${TEAM_NAMES[team]}误译`, value: String(game.miscommunications[team]) },
  ]);
}

/** Builds the review document after terminal settlement; incomplete state is an error. */
export function toDecryptoReviewDocument(input: {
  readonly state: DecryptoState;
  readonly roomCode: string;
}): RoomReviewDocument {
  const { state, roomCode } = input;
  if (state.phase.kind !== 'ended') {
    throw new Error(`[FAIL-FAST] Decrypto review built in phase ${state.phase.kind}`);
  }
  const game = state.phase.game;
  if (game.outcome === null || game.keywords === null)
    throw new Error('[FAIL-FAST] Decrypto ended review is missing its outcome or keywords');
  const history = roundTimeline(game);
  const tiebreak = tiebreakTimeline(game);
  if (tiebreak !== null) history.push(tiebreak);
  return {
    roundKey: `game-${state.gameSequence}`,
    kicker: `解码战 · 第 ${state.gameSequence} 局`,
    fileStem: `${DECRYPTO_GAME_TYPE}-${roomCode}-${state.gameSequence}`,
    footer: REVIEW_GENERATED_FOOTER,
    pages: [
      {
        key: 'result',
        label: null,
        blocks: [
          {
            kind: 'hero',
            headline: [{ kind: 'text', text: outcomeText(game.outcome) }],
            tone: game.outcome === 'shared' ? 'highlight' : teamTone(game.outcome),
            stamps: [],
            byline: `共进行 ${game.round} 轮`,
          },
          {
            kind: 'stats',
            items: scoreItems(game),
          },
          {
            kind: 'facts',
            items: [
              { label: '蓝队关键词', value: game.keywords.blue.join(' · ') },
              { label: '紫队关键词', value: game.keywords.purple.join(' · ') },
            ],
          },
          { kind: 'section', title: '对局记录' },
          { kind: 'timeline', steps: history },
          { kind: 'section', title: '参与者' },
          { kind: 'roster', columns: 2, rows: participantRows(state, game) },
        ],
      },
    ],
  };
}
