import {
  DRAWGUESS_REACTIONS,
  type DrawGuessReaction,
} from '@game-judge/game-engine/games/drawguess/public';

import { GameStatsReactionIcon } from '@/components/GameStatsPanel';

import type { DrawGuessRoomScreenState } from '../hooks/useDrawGuessRoomState';

const REACTION_LABELS: Readonly<Record<DrawGuessReaction, string>> = {
  flower: '鲜花',
  egg: '鸡蛋',
  tomato: '番茄',
};
const REACTIONS = DRAWGUESS_REACTIONS.map((kind) => ({
  kind,
  label: REACTION_LABELS[kind],
}));

export function DrawGuessReactionPicker({
  drawerSeat,
  reactionsBySeat,
  seats,
  effectiveSeat,
  controlledSeat,
  isSubmitting,
  phaseRevision,
  turnIndex,
  submit,
}: {
  readonly drawerSeat: number;
  readonly reactionsBySeat: Readonly<Record<number, DrawGuessReaction>>;
  readonly seats: readonly { readonly seat: number; readonly displayName: string }[];
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly isSubmitting: boolean;
  readonly phaseRevision: number;
  readonly turnIndex: number;
  readonly submit: DrawGuessRoomScreenState['submit'];
}) {
  const myReaction = effectiveSeat === null ? undefined : reactionsBySeat[effectiveSeat];
  const canSend =
    effectiveSeat !== null && effectiveSeat !== drawerSeat && myReaction === undefined;
  const reactions = Object.values(reactionsBySeat);
  const senders = Object.keys(reactionsBySeat).flatMap((seatKey) => {
    const seat = Number(seatKey);
    const reaction = reactionsBySeat[seat];
    if (reaction === undefined) return [];
    const senderName = seats.find((candidate) => candidate.seat === seat)?.displayName;
    return [{ seat, senderName: senderName ?? `座位${seat + 1}`, reaction }];
  });
  const actionHint =
    effectiveSeat === drawerSeat
      ? '画手不能给本轮作画送互动'
      : effectiveSeat === null
        ? '入座后可送出一次互动'
        : myReaction !== undefined
          ? '本轮已送出互动'
          : '非画手每人每轮可送出一次互动';

  const sendReaction = (reaction: DrawGuessReaction, label: string) => {
    void submit(
      `送出${label}`,
      {
        type: 'drawguess.reaction.send',
        phaseRevision,
        turnIndex,
        reaction,
      },
      { controlledSeat },
    );
  };

  return (
    <section className="drawguess-reactions" aria-label="本轮互动">
      <div className="drawguess-reaction-controls">
        {REACTIONS.map(({ kind, label }) => (
          <button
            key={kind}
            className="drawguess-reaction-button"
            type="button"
            aria-pressed={myReaction === kind}
            disabled={!canSend || isSubmitting}
            onClick={() => sendReaction(kind, label)}
          >
            <GameStatsReactionIcon kind={kind} />
            <span>{myReaction === kind ? `已送${label}` : `送${label}`}</span>
          </button>
        ))}
      </div>
      <div className="drawguess-reaction-summary">
        {REACTIONS.map(({ kind, label }) => (
          <span key={kind}>
            {label} {reactions.filter((reaction) => reaction === kind).length}
          </span>
        ))}
        <span className="drawguess-reaction-hint">{actionHint}</span>
      </div>
      {senders.length === 0 ? (
        <p className="drawguess-reaction-senders">还没有人送出互动</p>
      ) : (
        <ul className="drawguess-reaction-senders" aria-label="送出互动的玩家">
          {senders.map(({ seat, senderName, reaction }) => {
            return (
              <li key={seat}>
                {senderName} 送出{REACTION_LABELS[reaction]}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
