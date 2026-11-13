/**
 * useBubbleDrag - floating bubble drag gesture + position persistence
 *
 * Pointer drag past a small threshold moves the bubble and saves where it lands; a plain
 * press is a click (opens the chat). The click that ends a drag is swallowed.
 * Contains no game business logic.
 */

import {
  type KeyboardEvent,
  type PointerEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  type AIChatBubblePosition,
  readAIChatBubblePosition,
  writeAIChatBubblePosition,
} from '@/games/werewolf/services/aiChatBubblePositionStore';

import {
  type BubblePosition,
  type BubbleViewport,
  clampBubblePosition,
  getDefaultPosition,
} from './bubbleLayout';

const DRAG_THRESHOLD = 10;
const KEYBOARD_MOVE_STEP = 16;
const KEYBOARD_DIRECTIONS: Record<string, BubblePosition> = {
  ArrowUp: { x: 0, y: -KEYBOARD_MOVE_STEP },
  ArrowDown: { x: 0, y: KEYBOARD_MOVE_STEP },
  ArrowLeft: { x: -KEYBOARD_MOVE_STEP, y: 0 },
  ArrowRight: { x: KEYBOARD_MOVE_STEP, y: 0 },
};
/**
 * Window size whose height ignores keyboard-induced shrinking (WeChat web-view): the height
 * changes only with the width (rotation) or when it grows (keyboard dismissed).
 */
function createStableViewport() {
  let snapshot: BubbleViewport = { width: window.innerWidth, height: window.innerHeight };
  const subscribe = (onChange: () => void) => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width === snapshot.width && height <= snapshot.height) return;
      snapshot = { width, height };
      onChange();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  };
  return { subscribe, getSnapshot: () => snapshot };
}

interface DragStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly origin: AIChatBubblePosition;
}

interface UseBubbleDragReturn {
  readonly position: AIChatBubblePosition;
  readonly handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly handlePointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly handlePointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly handlePointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly handlePointerCancel: () => void;
  /** The bubble's click: opens the chat unless the click ends a drag. */
  readonly handleClick: () => void;
}

/**
 * @param onOpen callback when bubble is tapped (opens chat window)
 */
export function useBubbleDrag(onOpen: () => void, userId: string): UseBubbleDragReturn {
  // The saved or dragged position; null keeps the default corner. Clamped to the viewport on
  // every render, so a rotation re-clamps it.
  const [placedPosition, setPlacedPosition] = useState(() => readAIChatBubblePosition(userId));
  const [viewportSource] = useState(createStableViewport);
  const viewport = useSyncExternalStore(viewportSource.subscribe, viewportSource.getSnapshot);
  const position = clampBubblePosition(
    placedPosition ?? getDefaultPosition(viewport.width, viewport.height),
    viewport,
  );
  const dragStartRef = useRef<DragStart | null>(null);
  const isDraggingRef = useRef(false);
  const suppressClickRef = useRef(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const direction = KEYBOARD_DIRECTIONS[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    const nextPosition = clampBubblePosition(
      { x: position.x + direction.x, y: position.y + direction.y },
      viewport,
    );
    setPlacedPosition(nextPosition);
    writeAIChatBubblePosition(userId, nextPosition);
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: position,
    };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = dragStartRef.current;
    if (start === null || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      isDraggingRef.current = true;
      setPlacedPosition(
        clampBubblePosition({ x: start.origin.x + dx, y: start.origin.y + dy }, viewport),
      );
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = dragStartRef.current;
    if (start === null || start.pointerId !== event.pointerId) return;
    dragStartRef.current = null;
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    suppressClickRef.current = true;
    writeAIChatBubblePosition(
      userId,
      clampBubblePosition(
        {
          x: start.origin.x + event.clientX - start.x,
          y: start.origin.y + event.clientY - start.y,
        },
        viewport,
      ),
    );
  };

  // The browser took the gesture over: the bubble stays where it was dragged, unsaved.
  const handlePointerCancel = () => {
    dragStartRef.current = null;
    isDraggingRef.current = false;
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen();
  };

  return {
    position,
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  };
}
