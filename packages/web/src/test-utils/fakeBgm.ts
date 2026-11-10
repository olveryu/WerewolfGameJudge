import { vi } from 'vitest';

/** A BGM player fake with real playing state, read by hooks exactly as they read the player. */
export function createFakeBgm() {
  let playing = false;
  const listeners = new Set<() => void>();
  const setPlaying = (next: boolean): void => {
    if (playing === next) return;
    playing = next;
    for (const listener of listeners) listener();
  };
  return {
    startBgm: vi.fn<(urls: readonly string[]) => void>(() => setPlaying(true)),
    stopBgm: vi.fn<() => void>(() => setPlaying(false)),
    isBgmPlaying: (): boolean => playing,
    subscribeBgm: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** The player stopped on its own (play() rejected, no AudioContext). */
    stopOnItsOwn: (): void => setPlaying(false),
  };
}
