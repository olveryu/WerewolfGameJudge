/**
 * useBubbleDrag - floating bubble drag gesture + position persistence
 *
 * Manages bubble touch/drag interaction, boundary constraints, and MMKV position persistence.
 * Short tap counts as click (open chat); drag distance over threshold counts as drag.
 * Provides gesture handling, Animated animation, and MMKV position persistence. Contains no game business logic.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, type GestureResponderEvent, Platform, useWindowDimensions } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

import {
  readAIChatBubblePosition,
  writeAIChatBubblePosition,
} from '@/games/werewolf/services/aiChatBubblePositionStore';

import {
  BUBBLE_HEIGHT,
  BUBBLE_HORIZONTAL_MARGIN,
  BUBBLE_MARGIN,
  BUBBLE_WIDTH,
  getDefaultPosition,
} from './AIChatBubble.styles';

const DRAG_THRESHOLD = 10;

interface UseBubbleDragReturn {
  position: { x: number; y: number };
  scaleAnim: Animated.Value;
  handleTouchStart: (e: GestureResponderEvent) => void;
  handleTouchMove: (e: GestureResponderEvent) => void;
  handleTouchEnd: () => void;
  handleBubblePress: () => void;
}

/**
 * @param onOpen callback when bubble is tapped (opens chat window)
 */
export function useBubbleDrag(onOpen: () => void, userId: string): UseBubbleDragReturn {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Stable height that ignores keyboard-induced viewport shrink (WeChat web-view).
  // Updated only on width change (= rotation) or first mount.
  const stableHeightRef = useRef(screenHeight);
  const prevWidthRef = useRef(screenWidth);
  if (screenWidth !== prevWidthRef.current) {
    // Width changed -> likely rotation, accept new height
    stableHeightRef.current = screenHeight;
    prevWidthRef.current = screenWidth;
  } else if (screenHeight > stableHeightRef.current) {
    // Height grew (keyboard dismissed) -> accept the larger value
    stableHeightRef.current = screenHeight;
  }
  // Height shrank (keyboard opened) -> keep the old stableHeight
  const stableHeight = stableHeightRef.current;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [position, setPosition] = useState(() => getDefaultPosition(screenWidth, stableHeight));
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);
  const justHandledTouchRef = useRef(false);

  // Track latest position via ref to avoid stale closure in handleTouchEnd
  const positionRef = useRef(position);
  positionRef.current = position;

  // ── Load saved position ────────────────────────────
  useEffect(() => {
    const saved = readAIChatBubblePosition(userId);
    if (saved !== null) {
      // Clamp to current screen bounds (screen may have rotated since save)
      const clampedX = Math.max(
        BUBBLE_HORIZONTAL_MARGIN,
        Math.min(screenWidth - BUBBLE_WIDTH - BUBBLE_HORIZONTAL_MARGIN, saved.x),
      );
      const clampedY = Math.max(
        BUBBLE_MARGIN + 50,
        Math.min(stableHeight - BUBBLE_HEIGHT - BUBBLE_MARGIN, saved.y),
      );
      setPosition({ x: clampedX, y: clampedY });
    }
    // Re-clamp when screen dimensions change (rotation)
  }, [screenWidth, stableHeight, userId]);

  // ── Bubble press (short tap) ───────────────────────
  const handleBubblePress = useCallback(() => {
    if (justHandledTouchRef.current) {
      justHandledTouchRef.current = false;
      return;
    }
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
    onOpen();
  }, [scaleAnim, onOpen]);

  // ── Touch handlers ─────────────────────────────────
  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    const touch = e.nativeEvent;
    dragStartRef.current = {
      x: touch.pageX,
      y: touch.pageY,
      posX: positionRef.current.x,
      posY: positionRef.current.y,
    };
    isDraggingRef.current = false;
    justHandledTouchRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      const touch = e.nativeEvent;
      const dx = touch.pageX - dragStartRef.current.x;
      const dy = touch.pageY - dragStartRef.current.y;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        isDraggingRef.current = true;

        const newX = Math.max(
          BUBBLE_HORIZONTAL_MARGIN,
          Math.min(
            screenWidth - BUBBLE_WIDTH - BUBBLE_HORIZONTAL_MARGIN,
            dragStartRef.current.posX + dx,
          ),
        );
        const newY = Math.max(
          BUBBLE_MARGIN + 50,
          Math.min(stableHeight - BUBBLE_HEIGHT - BUBBLE_MARGIN, dragStartRef.current.posY + dy),
        );

        setPosition({ x: newX, y: newY });
      }
    },
    [screenWidth, stableHeight],
  );

  const handleTouchEnd = useCallback(() => {
    if (isDraggingRef.current) {
      writeAIChatBubblePosition(userId, positionRef.current);
      justHandledTouchRef.current = true;
    } else {
      justHandledTouchRef.current = true;
      handleBubblePress();
    }
  }, [handleBubblePress, userId]);

  return {
    position,
    scaleAnim,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleBubblePress,
  };
}
