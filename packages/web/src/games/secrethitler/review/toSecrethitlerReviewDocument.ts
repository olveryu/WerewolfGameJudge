import {
  getSecrethitlerViewModel,
  type SecrethitlerState,
  type SecrethitlerViewModel,
} from '@game-judge/game-engine/games/secrethitler/public';

import { REVIEW_GENERATED_FOOTER } from '@/features/room/review/reviewCopy';
import type {
  ReviewBlock,
  ReviewTimelineStep,
  RoomReviewDocument,
} from '@/features/room/review/types';

import { getSecrethitlerIdentityName } from '../components/SecrethitlerRoleCardAdapter';
import { SECRETHITLER_END_COPY, SECRETHITLER_POWER_COPY } from '../room/secrethitlerPresentation';

function historyBlocks(view: SecrethitlerViewModel): readonly ReviewBlock[] {
  const governments: ReviewTimelineStep[] = view.history.governments.map((record, index) => ({
    title: `第 ${index + 1} 次政府提名`,
    tone: record.outcome === 'passed' ? 'good' : 'muted',
    lines: [
      [
        {
          kind: 'text',
          tone: 'neutral',
          text: `总统 ${record.presidentSeat + 1} 号 · 总理 ${record.chancellorSeat + 1} 号 · ${record.outcome === 'passed' ? '通过' : record.outcome === 'rejected' ? '未通过' : '未完成'}`,
        },
      ],
      [
        {
          kind: 'text',
          tone: 'neutral',
          text:
            record.votes !== null
              ? record.votes
                  .map(({ seat, vote }) => `${seat + 1}号${vote === 'ja' ? '赞成' : '反对'}`)
                  .join('、')
              : record.voteCounts !== null
                ? `暗投：赞成 ${record.voteCounts.ja} 票，反对 ${record.voteCounts.nein} 票`
                : '尚未揭晓选票',
        },
      ],
    ],
  }));
  return [
    { kind: 'section', title: '政府选举' },
    { kind: 'timeline', steps: governments },
    { kind: 'section', title: '政策进程' },
    {
      kind: 'timeline',
      steps: view.history.policies.map((record, index) => ({
        title: `第 ${index + 1} 张政策`,
        tone: record.policy === 'liberal' ? 'good' : 'evil',
        lines: [
          [
            {
              kind: 'text',
              tone: 'neutral',
              text: `${record.policy === 'liberal' ? '自由派' : '法西斯'}政策 · ${record.source === 'chaos' ? '三次失败自动施行' : '政府施行'}`,
            },
          ],
        ],
      })),
    },
    { kind: 'section', title: '总统行动' },
    {
      kind: 'timeline',
      steps: view.history.actions.map((record) => ({
        title: SECRETHITLER_POWER_COPY[record.action],
        tone: 'neutral',
        lines: [
          [
            {
              kind: 'text',
              tone: 'neutral',
              text: `总统 ${record.presidentSeat + 1} 号${record.targetSeat === null ? '' : ` · 目标 ${record.targetSeat + 1} 号`}`,
            },
          ],
        ],
      })),
    },
  ];
}

/** Builds the ended round's public verdict, identities and complete public action facts. */
export function toSecrethitlerReviewDocument(input: {
  readonly state: SecrethitlerState;
  readonly roomCode: string;
}): RoomReviewDocument {
  const { state, roomCode } = input;
  if (state.phase.kind !== 'ended')
    throw new Error(`[FAIL-FAST] Secrethitler review built in phase ${state.phase.kind}`);
  const view = getSecrethitlerViewModel(state, null);
  const winner = state.phase.winner;
  return {
    roundKey: `game-${state.gameSequence}`,
    kicker: `第 ${state.gameSequence} 局 · 终局`,
    fileStem: `secrethitler-${roomCode}-${state.gameSequence}`,
    footer: REVIEW_GENERATED_FOOTER,
    pages: [
      {
        key: 'result',
        label: null,
        blocks: [
          {
            kind: 'hero',
            headline: [
              { kind: 'text', text: `${winner === 'liberal' ? '自由派' : '法西斯阵营'}获胜` },
            ],
            tone: winner === 'liberal' ? 'good' : 'evil',
            stamps: [],
            byline: SECRETHITLER_END_COPY[state.phase.reason],
          },
          {
            kind: 'stats',
            items: [
              { label: '自由派政策', value: String(view.liberalPolicies) },
              { label: '法西斯政策', value: String(view.fascistPolicies) },
            ],
          },
          { kind: 'section', title: '全员身份' },
          {
            kind: 'roster',
            columns: 1,
            rows: view.seats.map((player) => {
              if (player.identity === null)
                throw new Error(`[FAIL-FAST] Missing ended identity ${player.seat}`);
              const faction = player.identity === 'liberal' ? 'liberal' : 'fascist';
              const won = faction === winner;
              return {
                seat: player.seat,
                seatTone: faction === 'liberal' ? 'good' : 'evil',
                name: player.displayName,
                role: getSecrethitlerIdentityName(player.identity),
                status: `${won ? '获胜' : '落败'}${state.livingSeats.includes(player.seat) ? '' : ' · 已处决'}`,
                statusTone: won ? 'highlight' : 'muted',
                isOut: !state.livingSeats.includes(player.seat),
              };
            }),
          },
          ...historyBlocks(view),
        ],
      },
    ],
  };
}
