import { SPOTMATCH_SUCCESS_PAUSE_MS } from '@game-judge/game-engine/games/spotmatch/public';
import { useLayoutEffect, useRef } from 'react';

/** Join the server's success beat; neither animation completion nor reduced motion gates play. */
export function useSpotmatchCardFlight(
  until: number,
  isOwnSuccess: boolean,
  reducedMotion: boolean,
) {
  const stage = useRef<HTMLElement>(null);
  const centralPosition = useRef<HTMLDivElement>(null);
  const ownPosition = useRef<HTMLDivElement>(null);
  const flight = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const stamp = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (reducedMotion || until <= Date.now()) return;
    const root = stage.current;
    const target = centralPosition.current;
    const moving = flight.current;
    const origin = isOwnSuccess ? ownPosition.current : stage.current;
    if (root === null || target === null || moving === null || origin === null) return;
    const bounds = root.getBoundingClientRect();
    const destination = target.getBoundingClientRect();
    const source = origin.getBoundingClientRect();
    const endX = destination.left - bounds.left + root.scrollLeft;
    const endY = destination.top - bounds.top + root.scrollTop;
    const startX = isOwnSuccess ? source.left - bounds.left + root.scrollLeft : root.clientWidth;
    const startY = isOwnSuccess
      ? source.top - bounds.top + root.scrollTop
      : endY - destination.height / 2;
    moving.style.width = `${destination.width}px`;
    const animation = moving.animate(
      [
        { transform: `translate(${startX}px, ${startY}px) rotate(7deg) scale(1)`, opacity: 0 },
        {
          transform: `translate(${startX}px, ${startY}px) rotate(7deg) scale(1)`,
          opacity: 1,
          offset: 0.08,
          easing: 'cubic-bezier(.16,1,.3,1)',
        },
        {
          transform: `translate(${endX}px, ${endY}px) rotate(-4deg) scale(.97)`,
          opacity: 1,
          offset: 0.42,
          easing: 'cubic-bezier(.16,1,.3,1)',
        },
        {
          transform: `translate(${endX}px, ${endY}px) rotate(0deg) scale(1)`,
          opacity: 1,
          offset: 0.52,
        },
        {
          transform: `translate(${endX}px, ${endY}px) rotate(0deg) scale(1)`,
          opacity: 1,
        },
      ],
      { duration: SPOTMATCH_SUCCESS_PAUSE_MS, easing: 'linear', fill: 'both' },
    );
    const countdown = progress.current?.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration: SPOTMATCH_SUCCESS_PAUSE_MS, fill: 'both' },
    );
    const confirmation = stamp.current?.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) rotate(-12deg) scale(1.5)' },
        {
          opacity: 0,
          transform: 'translate(-50%, -50%) rotate(-12deg) scale(1.5)',
          offset: 0.45,
          easing: 'cubic-bezier(.16,1,.3,1)',
        },
        { opacity: 1, transform: 'translate(-50%, -50%) rotate(-12deg) scale(.95)', offset: 0.56 },
        { opacity: 1, transform: 'translate(-50%, -50%) rotate(-12deg) scale(1)', offset: 0.65 },
        { opacity: 1, transform: 'translate(-50%, -50%) rotate(-12deg) scale(1)' },
      ],
      { duration: SPOTMATCH_SUCCESS_PAUSE_MS, easing: 'linear', fill: 'both' },
    );
    const elapsed = Math.max(0, SPOTMATCH_SUCCESS_PAUSE_MS - (until - Date.now()));
    animation.currentTime = elapsed;
    if (countdown) countdown.currentTime = elapsed;
    if (confirmation) confirmation.currentTime = elapsed;
    return () => {
      animation.cancel();
      countdown?.cancel();
      confirmation?.cancel();
    };
  }, [until, isOwnSuccess, reducedMotion]);
  return { stage, centralPosition, ownPosition, flight, progress, stamp };
}
