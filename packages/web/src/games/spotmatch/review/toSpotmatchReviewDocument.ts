import {
  getSpotmatchViewModel,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';

import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type { RoomReviewDocument } from '@/features/room/review/types';

export function toSpotmatchReviewDocument(input: {
  readonly state: SpotmatchState;
  readonly roomCode: string;
}): RoomReviewDocument {
  const { state, roomCode } = input;
  if (state.phase.kind !== 'ended') {
    throw new Error(`[FAIL-FAST] Spotmatch review built in phase ${state.phase.kind}`);
  }
  const view = getSpotmatchViewModel(state, null);
  const winner = view.seats.find((seat) => seat.seat === state.round?.winnerSeat);
  return {
    roundKey: `game-${state.gameSequence}`,
    kicker: `一眼成对 · 第 ${state.gameSequence} 局`,
    fileStem: `spotmatch-${roomCode}-${state.gameSequence}`,
    footer: REVIEW_GENERATED_FOOTER,
    isAborted: false,
    pages: [
      {
        key: 'result',
        label: null,
        blocks: [
          {
            kind: 'hero',
            headline: [{ kind: 'text', text: `${winner?.displayName ?? '玩家'} 率先出完` }],
            tone: 'neutral',
            stamps: [],
            byline: '按剩余张数排名，同数并列',
          },
          { kind: 'section', title: '本局出牌' },
          {
            kind: 'roster',
            columns: 1,
            rows: [...view.seats]
              .sort((a, b) => (a.remaining ?? 0) - (b.remaining ?? 0))
              .map((seat) => ({
                seat: seat.seat,
                seatTone: 'neutral',
                name: seat.displayName,
                role: `第 ${seat.rank} 名 · 剩余 ${seat.remaining} 张`,
                status: `出对 ${seat.correct} · 误点 ${seat.mistakes}`,
                statusTone: 'muted',
                isOut: false,
              })),
          },
        ],
      },
    ],
  };
}
