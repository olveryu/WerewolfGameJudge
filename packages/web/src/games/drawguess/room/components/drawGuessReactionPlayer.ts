import {
  type DrawGuessReactionAnimation,
  type DrawGuessReactionMessage,
  paintDrawGuessReaction,
} from './drawGuessReactionArt';

export interface DrawGuessReactionPlayer {
  readonly enqueue: (message: DrawGuessReactionMessage) => void;
  readonly dispose: () => void;
}

function createAnimation(
  message: DrawGuessReactionMessage,
  now: number,
): DrawGuessReactionAnimation {
  return {
    ...message,
    startedAt: now,
    particles: Array.from({ length: 22 }, (_, index) => {
      const angle = (index / 22) * Math.PI * 2 + (index % 3) * 0.06;
      const speed = 80 + ((index * 37) % 110);
      return {
        index,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - 70,
        radius: 3 + ((index * 7) % 5),
        spin: 0.5 + ((index * 13) % 8),
      };
    }),
  };
}

/** Queues simultaneous reactions and releases every animation resource when the stage unmounts. */
export function createDrawGuessReactionPlayer(
  canvas: HTMLCanvasElement,
  onChange: (message: DrawGuessReactionMessage | null) => void,
): DrawGuessReactionPlayer {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D is unavailable for DrawGuess reaction effects');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const queue: DrawGuessReactionMessage[] = [];
  let active: DrawGuessReactionAnimation | null = null;
  let frame: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const schedule = (): void => {
    if (!disposed && frame === null) frame = requestAnimationFrame(render);
  };
  const render = (now: number): void => {
    frame = null;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.clearRect(0, 0, width, height);
    if (active === null) {
      const next = queue.shift();
      if (next === undefined) return;
      active = createAnimation(next, now);
      onChange(next);
    }
    const elapsed = now - active.startedAt;
    const duration = reducedMotion.matches ? 2400 : 3050;
    if (elapsed >= duration) {
      active = null;
      onChange(null);
      if (queue.length > 0) schedule();
      return;
    }
    paintDrawGuessReaction(context, active, elapsed, width, height, reducedMotion.matches);
    if (reducedMotion.matches) {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(schedule, duration - elapsed);
    } else {
      schedule();
    }
  };
  const resize = (): void => {
    const ratio = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (active !== null) schedule();
  };
  const changeMotion = (): void => {
    if (timer !== null) clearTimeout(timer);
    if (active !== null) schedule();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  reducedMotion.addEventListener('change', changeMotion);
  resize();

  return {
    enqueue(message) {
      queue.push(message);
      if (active === null) schedule();
    },
    dispose() {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
      observer.disconnect();
      reducedMotion.removeEventListener('change', changeMotion);
      queue.length = 0;
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    },
  };
}
