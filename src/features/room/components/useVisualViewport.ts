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
 * This module also owns the single pan reset: when the browser pans the
 * visual viewport to reveal a focused text input (`offsetTop > 0`) and
 * that input is already fully inside the visible viewport, the pan has
 * served its purpose and is scrolled back to zero, so the task header
 * and canvas stay in view instead of staying clipped above the fold.
 * The reset lives here and nowhere else.
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

let resetFrameId: number | null = null;

/** The focused text input, if focus is on one; null otherwise. */
function getFocusedTextInput(): Element | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  if (active === null) return null;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  ) {
    return active;
  }
  return null;
}

/**
 * Scrolls the browser's keyboard pan back to zero, but only when every
 * condition holds: the viewport is panned (`offsetTop > 0`), the
 * keyboard is open (`height < window.innerHeight`), and the focused
 * text input is already fully inside the visible viewport, so the
 * browser has no reason to pan it back. When any condition fails the
 * pan is still doing its job and is left alone.
 *
 * Means: `window.scrollTo(0, 0)`. The app sets `body { overflow:
 * hidden }` (`web/index.html`), which still leaves a scroll container
 * that programmatic scrolling can move — only `overflow: clip` would
 * forbid it. The reset is scheduled on `requestAnimationFrame`, never
 * inside the viewport event handler, so it runs after the browser's
 * pan has settled. After the reset `offsetTop` is 0, so the condition
 * no longer holds and the reset cannot loop.
 *
 * Limit: only a real device can prove the reset wins against the
 * web-view's own focus scroll — the tests below pin only the gating
 * logic, never the WeChat web-view behaviour.
 */
function resetPanIfUnneeded(): void {
  if (!isWebViewportAvailable() || typeof document === 'undefined') return;
  const current = readSnapshot();
  if (current === null || current.offsetTop <= 0) return;
  if (current.height >= window.innerHeight) return;
  const input = getFocusedTextInput();
  if (input === null) return;
  if (input.getBoundingClientRect().bottom > current.height) return;
  window.scrollTo(0, 0);
}

function schedulePanReset(): void {
  if (resetFrameId !== null) return;
  resetFrameId = window.requestAnimationFrame(() => {
    resetFrameId = null;
    resetPanIfUnneeded();
  });
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
        if (next.offsetTop > 0) schedulePanReset();
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
      if (resetFrameId !== null) {
        window.cancelAnimationFrame(resetFrameId);
        resetFrameId = null;
      }
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
 * viewport height captured before the keyboard opened. The pan offset
 * is not subtracted: the keyboard only shrinks the visual viewport,
 * and panning it does not change its height.
 */
export function computeKeyboardHeight(
  initialLayoutHeight: number,
  viewportSnapshot: VisualViewportSnapshot,
): number {
  return Math.max(0, initialLayoutHeight - viewportSnapshot.height);
}

/**
 * Keyboard inset for a container whose bottom edge sits at
 * `containerBottom`, measured by React Native Web's `measureInWindow`
 * — which returns `getBoundingClientRect` values, already in visual
 * viewport coordinates. The pan offset is not subtracted again: the
 * rect already moved with the pan, so subtracting `offsetTop` a second
 * time would shrink the inset exactly when the pan is largest.
 */
export function computeContainerInset(
  containerBottom: number,
  viewportSnapshot: VisualViewportSnapshot,
): number {
  return Math.max(0, containerBottom - viewportSnapshot.height);
}
