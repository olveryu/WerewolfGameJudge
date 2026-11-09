/**
 * Shared non-scrolling task frame for games with a keyboard input.
 *
 * The heading stays pinned, the body shrinks to the space left above the on-screen keyboard,
 * and the footer stays pinned at the bottom. The frame adds no scrolling container, so focusing
 * the input never pulls the task content down; game-owned body content may still scroll
 * internally (for example Story Relay's previous-entry area).
 *
 * The keyboard inset comes from `visualViewport`: when the keyboard covers the bottom of the
 * frame, the frame pads its bottom by the covered height so the footer stays visible.
 */

import './RoomTaskFrame.css';

import { type ReactNode, useEffect, useRef, useState } from 'react';

interface RoomTaskFrameProps {
  /** Pinned heading supplied by the game (title, timer, countdown). */
  readonly header: ReactNode;
  /** Shrinking body: task content that yields space to the keyboard first. */
  readonly children: ReactNode;
  /** Pinned footer supplied by the game (actions, composer). Null omits it. */
  readonly footer: ReactNode;
  /** Width cap (px) declared by the game. */
  readonly maxWidth: number;
  readonly testId?: string;
  /** Geometry-only class for the task column (for example a wider horizontal padding). */
  readonly className?: string;
}

/** Returns the height (px) of `element` hidden below the visual viewport, 0 when none. */
function useKeyboardInset(element: { readonly current: HTMLElement | null }): number {
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    // Without visualViewport (jsdom) nothing can cover the frame.
    if (!viewport) return;
    const update = () => {
      const container = element.current;
      if (container === null) throw new Error('Room task viewport missing');
      const { top, height } = container.getBoundingClientRect();
      setKeyboardInset(Math.max(0, top + height - viewport.height - viewport.offsetTop));
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [element]);
  return keyboardInset;
}

/**
 * Renders a keyboard-safe task column: header, shrinking body, footer.
 * @pre Callers keep every keyboard input in the body or footer, never inside a scrolling container.
 */
export function RoomTaskFrame({
  header,
  children,
  footer,
  maxWidth,
  testId,
  className,
}: RoomTaskFrameProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const keyboardInset = useKeyboardInset(viewportRef);
  return (
    <div ref={viewportRef} className="room-task-viewport">
      <div className="room-task-viewport-inner" style={{ paddingBottom: keyboardInset }}>
        <div
          className={['room-task-frame', className].filter(Boolean).join(' ')}
          style={{ maxWidth }}
          data-testid={testId}
        >
          {header}
          <div className="room-task-frame-body">{children}</div>
          {footer !== null && <div className="room-task-frame-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
