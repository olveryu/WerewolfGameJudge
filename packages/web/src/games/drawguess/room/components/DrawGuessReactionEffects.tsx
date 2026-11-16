import type { DrawGuessReaction } from '@game-judge/game-engine/games/drawguess/public';
import { useEffect, useRef, useState } from 'react';

import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import type { DrawGuessReactionMessage } from './drawGuessReactionArt';
import {
  createDrawGuessReactionPlayer,
  type DrawGuessReactionPlayer,
} from './drawGuessReactionPlayer';

const REACTION_MESSAGES: Readonly<Record<DrawGuessReaction, string>> = {
  flower: '送来一束鲜花',
  egg: '扔来一颗鸡蛋',
  tomato: '扔来一颗番茄',
};

/** Announces and animates only newly accepted reactions, never the existing snapshot history. */
export function DrawGuessReactionEffects({
  reactionsBySeat,
  seats,
}: {
  readonly reactionsBySeat: Readonly<Record<number, DrawGuessReaction>>;
  readonly seats: readonly { readonly seat: number; readonly displayName: string }[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<DrawGuessReactionPlayer | null>(null);
  const seenSeats = useRef(new Set(Object.keys(reactionsBySeat)));
  const [message, setMessage] = useState<DrawGuessReactionMessage | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (element === null) throw new Error('DrawGuess reaction canvas was not mounted');
    let current: DrawGuessReactionPlayer;
    try {
      current = createDrawGuessReactionPlayer(element, setMessage);
    } catch (error: unknown) {
      handleError(error, { label: '播放互动动画', logger: roomScreenLog });
      return;
    }
    player.current = current;
    return () => {
      current.dispose();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    for (const [seatKey, kind] of Object.entries(reactionsBySeat)) {
      if (seenSeats.current.has(seatKey)) continue;
      seenSeats.current.add(seatKey);
      const seat = Number(seatKey);
      const sender = seats.find((candidate) => candidate.seat === seat);
      if (sender === undefined) {
        const error = new Error(`DrawGuess reaction seat ${seat} has no seat profile`);
        handleError(error, { label: '匹配互动赠送者', logger: roomScreenLog });
        throw error;
      }
      player.current?.enqueue({
        kind,
        sender: sender.displayName,
      });
    }
  }, [reactionsBySeat, seats]);

  return (
    <>
      <canvas ref={canvas} className="drawguess-reaction-effect-canvas" aria-hidden />
      <p
        className="drawguess-reaction-announcement"
        role="status"
        aria-atomic="true"
        hidden={message === null}
      >
        {message !== null && `${message.sender} ${REACTION_MESSAGES[message.kind]}`}
      </p>
    </>
  );
}
