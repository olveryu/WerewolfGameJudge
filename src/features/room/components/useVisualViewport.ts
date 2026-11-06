/**
 * Single shared visualViewport source for every keyboard-aware surface.
 *
 * Web keyboards are observed in exactly one place: this module owns the
 * only `visualViewport` listeners in the app (`resize` + `scroll`). The
 * task frame (`RoomTaskViewport`, container-relative inset) and the AI
 * chat bubble (`useKeyboardHeight`, viewport-absolute keyboard height)
 * both derive their values from the same snapshot, so one keyboard event
 * produces one inset everywhere instead of three competing listeners
 * recomputing it.
 *
 * On native there is no visualViewport: the snapshot stays null and each
 * consumer keeps its native mechanism (`KeyboardAvoidingView` for the
 * task frame, `Keyboard` events for the bubble).
 */

import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/** Live visualViewport geometry: height and pan offset, in CSS pixels. */
export interface VisualViewportSnapshot {
  readonly height: number;
  readonly offsetTop: number;
}

let snapshot: VisualViewportSnapshot | null = null;
const listeners = new Set<() => void>();
let viewport: VisualViewport | null = null;
let handleChange: (() => void) | null = null;

function isWebViewportAvailable(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.visualViewport !== null &&
    window.visualViewport !== undefined
  );
}

function readSnapshot(): VisualViewportSnapshot | null {
  if (!isWebViewportAvailable()) return null;
  const current = window.visualViewport;
  if (current === null) return null;
  return { height: current.height, offsetTop: current.offsetTop };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && isWebViewportAvailable()) {
    const current = window.visualViewport;
    if (current !== null) {
      viewport = current;
      handleChange = () => {
        const next = readSnapshot();
        if (
          next === null ||
          (snapshot !== null &&
            next.height === snapshot.height &&
            next.offsetTop === snapshot.offsetTop)
        ) {
          return;
        }
        snapshot = next;
        for (const notify of [...listeners]) notify();
      };
      snapshot = readSnapshot();
      current.addEventListener('resize', handleChange);
      current.addEventListener('scroll', handleChange);
    }
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && viewport !== null && handleChange !== null) {
      viewport.removeEventListener('resize', handleChange);
      viewport.removeEventListener('scroll', handleChange);
      viewport = null;
      handleChange = null;
      snapshot = null;
    }
  };
}

function getSnapshot(): VisualViewportSnapshot | null {
  return snapshot;
}

/** Current visualViewport geometry, or null off-web / before the first event. */
export function useVisualViewport(): VisualViewportSnapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Keyboard height from a viewport snapshot, measured against the layout
 * viewport height captured before the keyboard opened. This is the
 * formula the AI chat bubble shipped with, unchanged.
 */
export function computeKeyboardHeight(
  initialLayoutHeight: number,
  viewportSnapshot: VisualViewportSnapshot,
): number {
  return Math.max(0, initialLayoutHeight - viewportSnapshot.height - viewportSnapshot.offsetTop);
}

/** Keyboard inset for a container whose bottom edge sits at `containerBottom`. */
export function computeContainerInset(
  containerBottom: number,
  viewportSnapshot: VisualViewportSnapshot,
): number {
  return Math.max(0, containerBottom - viewportSnapshot.height - viewportSnapshot.offsetTop);
}
