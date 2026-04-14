/**
 * useBubbleDrag - 浮动气泡拖动手势 + 位置持久化
 *
 * 管理气泡的 touch/drag 交互、边界约束、位置 MMKV 持久化。
 * 短按视为点击（打开聊天），拖动距离超过阈值视为拖拽。
 * 提供手势处理、Animated 动画和 MMKV 位置持久化。不含游戏业务逻辑。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, type GestureResponderEvent, Platform, useWindowDimensions } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

import { storage } from '@/lib/storage';

import {
  BUBBLE_HEIGHT,
  BUBBLE_MARGIN,
  BUBBLE_WIDTH,
  DEFAULT_POSITION,
} from './AIChatBubble.styles';

const STORAGE_KEY_POSITION = '@ai_chat_bubble_position';
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
 * @param onOpen 点击气泡时的回调（打开聊天窗口）
 */
export function useBubbleDrag(onOpen: () => void): UseBubbleDragReturn {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Stable height that ignores keyboard-induced viewport shrink (WeChat web-view).
  // Updated only on width change (= rotation) or first mount.
  const stableHeightRef = useRef(screenHeight);
  const prevWidthRef = useRef(screenWidth);
  if (screenWidth !== prevWidthRef.current) {
    // Width changed → likely rotation, accept new height
    stableHeightRef.current = screenHeight;
    prevWidthRef.current = screenWidth;
  } else if (screenHeight > stableHeightRef.current) {
    // Height grew (keyboard dismissed) → accept the larger value
    stableHeightRef.current = screenHeight;
  }
  // Height shrank (keyboard opened) → keep the old stableHeight
  const stableHeight = stableHeightRef.current;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);
  const justHandledTouchRef = useRef(false);

  // 用 ref 追踪最新 position，避免 handleTouchEnd 闭包 stale
  const positionRef = useRef(position);
  positionRef.current = position;

  // ── Load saved position ────────────────────────────
  useEffect(() => {
    const saved = storage.getString(STORAGE_KEY_POSITION);
    if (saved) {
      const parsed = JSON.parse(saved) as { x: number; y: number };
      // Clamp to current screen bounds (screen may have rotated since save)
      const clampedX = Math.max(
        BUBBLE_MARGIN,
        Math.min(screenWidth - BUBBLE_WIDTH - BUBBLE_MARGIN, parsed.x),
      );
      const clampedY = Math.max(
        BUBBLE_MARGIN + 50,
        Math.min(stableHeight - BUBBLE_HEIGHT - BUBBLE_MARGIN, parsed.y),
      );
      setPosition({ x: clampedX, y: clampedY });
    }
    // Re-clamp when screen dimensions change (rotation)
  }, [screenWidth, stableHeight]);

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
          BUBBLE_MARGIN,
          Math.min(screenWidth - BUBBLE_WIDTH - BUBBLE_MARGIN, dragStartRef.current.posX + dx),
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
      storage.set(STORAGE_KEY_POSITION, JSON.stringify(positionRef.current));
      justHandledTouchRef.current = true;
    } else {
      justHandledTouchRef.current = true;
      handleBubblePress();
    }
  }, [handleBubblePress]);

  return {
    position,
    scaleAnim,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleBubblePress,
  };
}
