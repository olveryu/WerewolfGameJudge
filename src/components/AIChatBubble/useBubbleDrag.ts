/**
 * useBubbleDrag - 浮动气泡拖动手势 + 位置持久化
 *
 * 管理气泡的 touch/drag 交互、边界约束、位置 AsyncStorage 持久化。
 * 短按视为点击（打开聊天），拖动距离超过阈值视为拖拽。
 *
 * ✅ 允许：手势处理、Animated、AsyncStorage 读写
 * ❌ 禁止：游戏业务逻辑
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, type GestureResponderEvent, Platform, useWindowDimensions } from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

import { chatLog } from '@/utils/logger';

import { BUBBLE_MARGIN, BUBBLE_SIZE, DEFAULT_POSITION } from './AIChatBubble.styles';

const STORAGE_KEY_POSITION = '@ai_chat_bubble_position';
const DRAG_THRESHOLD = 10;

export interface UseBubbleDragReturn {
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
    AsyncStorage.getItem(STORAGE_KEY_POSITION)
      .then((saved) => {
        if (saved) setPosition(JSON.parse(saved));
      })
      .catch((e) => {
        chatLog.warn('Failed to load bubble position:', e);
      });
  }, []);

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
          Math.min(screenWidth - BUBBLE_SIZE - BUBBLE_MARGIN, dragStartRef.current.posX + dx),
        );
        const newY = Math.max(
          BUBBLE_MARGIN + 50,
          Math.min(screenHeight - BUBBLE_SIZE - BUBBLE_MARGIN, dragStartRef.current.posY + dy),
        );

        setPosition({ x: newX, y: newY });
      }
    },
    [screenWidth, screenHeight],
  );

  const handleTouchEnd = useCallback(() => {
    if (isDraggingRef.current) {
      AsyncStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(positionRef.current)).catch(
        () => {},
      );
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
