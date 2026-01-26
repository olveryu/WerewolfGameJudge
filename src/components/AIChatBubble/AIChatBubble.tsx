/**
 * AI Chat Bubble - 全局悬浮聊天泡泡
 *
 * 在右下角显示一个悬浮按钮，点击后弹出聊天窗口
 * 使用 visualViewport API (Web) 处理键盘弹出
 * 支持读取游戏上下文（玩家视角，不作弊）
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  GestureResponderEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, spacing, borderRadius, typography, ThemeColors } from '../../theme';
import { sendChatMessage, ChatMessage, getDefaultApiKey, GameContext } from '../../services/AIChatService';
import { showAlert } from '../../utils/alert';
import { useGameFacade } from '../../contexts';
import { ROLE_SPECS } from '../../models/roles/spec/specs';
import type { BroadcastGameState } from '../../services/protocol/types';

const STORAGE_KEY_MESSAGES = '@ai_chat_messages';
const STORAGE_KEY_POSITION = '@ai_chat_bubble_position';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHAT_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
const CHAT_HEIGHT = 420;
const BUBBLE_SIZE = 56;
const BUBBLE_MARGIN = 16;

// 默认位置：右下角
const DEFAULT_POSITION = {
  x: SCREEN_WIDTH - BUBBLE_SIZE - BUBBLE_MARGIN,
  y: SCREEN_HEIGHT - BUBBLE_SIZE - 60,
};

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * 从游戏状态构建玩家视角的上下文（不包含作弊信息）
 */
function buildPlayerContext(
  state: BroadcastGameState | null,
  mySeat: number | null,
): GameContext {
  if (!state) {
    return { inRoom: false };
  }

  const context: GameContext = {
    inRoom: true,
    roomCode: state.roomCode,
    status: state.status,
    totalPlayers: Object.values(state.players).filter(Boolean).length,
  };

  // 我的座位和角色
  if (mySeat !== null && mySeat !== undefined) {
    context.mySeat = mySeat;
    const player = state.players[mySeat];
    if (player?.role) {
      context.myRole = player.role;
      const roleSpec = ROLE_SPECS[player.role];
      context.myRoleName = roleSpec?.displayName || player.role;
    }
  }

  // 当前阶段
  if (state.status === 'ongoing') {
    context.currentPhase = state.currentStepId ? `第一夜 - ${state.currentStepId}` : '第一夜';
  }

  // 已死亡玩家（公开信息）
  if (state.lastNightDeaths && state.lastNightDeaths.length > 0) {
    context.deadPlayers = state.lastNightDeaths;
  }

  // 玩家自己知道的信息（只能看到自己该看到的）
  const myKnowledge: string[] = [];

  // 预言家的查验结果
  if (context.myRole === 'seer' && state.seerReveal) {
    myKnowledge.push(`${state.seerReveal.targetSeat + 1}号是${state.seerReveal.result}`);
  }

  // 通灵师的查验结果
  if (context.myRole === 'psychic' && state.psychicReveal) {
    myKnowledge.push(`${state.psychicReveal.targetSeat + 1}号的身份是${state.psychicReveal.result}`);
  }

  // 女巫知道的信息
  if (context.myRole === 'witch' && state.witchContext) {
    if (state.witchContext.killedIndex >= 0) {
      myKnowledge.push(`今晚狼人刀了${state.witchContext.killedIndex + 1}号`);
    }
    const usedSkills: string[] = [];
    if (!state.witchContext.canSave) usedSkills.push('解药已用');
    if (!state.witchContext.canPoison) usedSkills.push('毒药已用');
    if (usedSkills.length > 0) {
      context.usedSkills = usedSkills;
    }
  }

  // 石像鬼的查验结果
  if (context.myRole === 'gargoyle' && state.gargoyleReveal) {
    myKnowledge.push(`${state.gargoyleReveal.targetSeat + 1}号的身份是${state.gargoyleReveal.result}`);
  }

  // 机械狼的学习结果
  if (context.myRole === 'wolfRobot' && state.wolfRobotReveal) {
    myKnowledge.push(`学习了${state.wolfRobotReveal.targetSeat + 1}号，获得了${state.wolfRobotReveal.result}的技能`);
  }

  if (myKnowledge.length > 0) {
    context.myKnowledge = myKnowledge;
  }

  return context;
}

export const AIChatBubble: React.FC = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const flatListRef = useRef<FlatList>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // 游戏 Facade - 用于获取游戏状态
  const facade = useGameFacade();

  // 拖动位置状态
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 直接使用环境变量中的 API Key（不需要用户配置）
  const apiKey = getDefaultApiKey();

  // 键盘高度（用于计算窗口底部偏移）
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Web 平台：使用 visualViewport API 监听键盘
  useEffect(() => {
    if (Platform.OS !== 'web' || globalThis.window === undefined) {
      return;
    }

    const viewport = globalThis.window.visualViewport;
    if (!viewport) return;

    // 记录初始高度
    const initialHeight = globalThis.window.innerHeight;

    const handleViewportChange = () => {
      // 键盘高度 = 初始高度 - 当前 viewport 高度 - viewport 滚动偏移
      // iOS Safari 上键盘弹出时 viewport 会滚动
      const kbHeight = initialHeight - viewport.height - viewport.offsetTop;
      setKeyboardHeight(Math.max(0, kbHeight));
    };

    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);
    return () => {
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  // 原生平台：使用 Keyboard API
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);


  // 按钮点击处理（需要在 handleTouchEnd 之前定义）
  const handleBubblePress = useCallback(() => {
    // 按钮动画
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setIsOpen(true);
  }, [scaleAnim]);

  // 拖动手势处理函数
  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    const touch = e.nativeEvent;
    dragStartRef.current = {
      x: touch.pageX,
      y: touch.pageY,
      posX: position.x,
      posY: position.y,
    };
    isDraggingRef.current = false;
  }, [position]);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const touch = e.nativeEvent;
    const dx = touch.pageX - dragStartRef.current.x;
    const dy = touch.pageY - dragStartRef.current.y;

    // 移动超过 10 像素才算拖动
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      isDraggingRef.current = true;

      let newX = dragStartRef.current.posX + dx;
      let newY = dragStartRef.current.posY + dy;

      // 边界限制
      newX = Math.max(BUBBLE_MARGIN, Math.min(SCREEN_WIDTH - BUBBLE_SIZE - BUBBLE_MARGIN, newX));
      newY = Math.max(BUBBLE_MARGIN + 50, Math.min(SCREEN_HEIGHT - BUBBLE_SIZE - BUBBLE_MARGIN, newY));

      setPosition({ x: newX, y: newY });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (isDraggingRef.current) {
      // 保存位置
      AsyncStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(position));
    } else {
      // 没有拖动，视为点击
      handleBubblePress();
    }
  }, [position, handleBubblePress]);

  // 加载消息和位置
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedMessages, savedPosition] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MESSAGES),
          AsyncStorage.getItem(STORAGE_KEY_POSITION),
        ]);
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        }
        if (savedPosition) {
          const pos = JSON.parse(savedPosition);
          setPosition(pos);
        }
      } catch {
        // Storage read failed, use defaults
      }
    };
    loadData();
  }, []);

  // 保存消息
  useEffect(() => {
    if (messages.length > 0) {
      AsyncStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    if (!apiKey) {
      showAlert('配置错误', 'AI 服务未配置');
      return;
    }

    const userMessage: DisplayMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // 收起键盘
    Keyboard.dismiss();

    // 获取游戏上下文（玩家视角，不作弊）
    const gameState = facade.getState();
    const mySeat = facade.getMySeatNumber();
    const gameContext = buildPlayerContext(gameState, mySeat);

    // 构建上下文（最近 10 条消息）
    const contextMessages: ChatMessage[] = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    contextMessages.push({ role: 'user', content: text });

    const response = await sendChatMessage(contextMessages, apiKey, gameContext);

    if (response.success && response.message) {
      const assistantMessage: DisplayMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } else {
      showAlert('发送失败', response.error || '未知错误');
    }

    setIsLoading(false);
  }, [inputText, isLoading, apiKey, messages]);

  const handleClearHistory = useCallback(async () => {
    setMessages([]);
    await AsyncStorage.removeItem(STORAGE_KEY_MESSAGES);
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: DisplayMessage }) => {
      const isUser = item.role === 'user';
      return (
        <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
            <Text style={[styles.messageText, isUser && styles.userText]}>{item.content}</Text>
          </View>
        </View>
      );
    },
    [styles]
  );

  // Web 专用样式：阻止拖动时页面滚动
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webDragStyle: any = Platform.OS === 'web' ? { touchAction: 'none', cursor: 'grab', userSelect: 'none' } : {};

  return (
    <>
      {/* 悬浮按钮 - 可拖动，支持 Web 桌面点击 */}
      <Animated.View
        style={[
          styles.bubbleContainer,
          {
            left: position.x,
            top: position.y,
            transform: [{ scale: scaleAnim }],
          },
          webDragStyle,
        ]}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 用 TouchableOpacity 包裹，确保 Web 桌面端鼠标点击生效 */}
        <TouchableOpacity
          style={styles.bubble}
          onPress={handleBubblePress}
          activeOpacity={0.8}
        >
          <Text style={styles.bubbleIcon}>🐺</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* 聊天窗口 Modal */}
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        {/* 使用 paddingBottom 来避开键盘 */}
        <View style={[styles.modalContainer, { paddingBottom: keyboardHeight + 10 }]}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsOpen(false)} />

          {/* 固定高度 */}
          <View style={styles.chatWindow}>
            {/* Header */}
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>🐺 狼人杀助手</Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity onPress={handleClearHistory} style={styles.headerBtn}>
                  <Text style={styles.headerBtnText}>🗑️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.headerBtn}>
                  <Text style={styles.headerBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    👋 你好！我是狼人杀助手{'\n'}
                    可以问我游戏规则、策略建议等
                  </Text>
                </View>
              }
            />

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="输入消息..."
                placeholderTextColor={colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!isLoading}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>↑</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // 悬浮按钮 - 使用 left/top 定位
    bubbleContainer: {
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: 1000,
    },
    bubble: {
      width: BUBBLE_SIZE,
      height: BUBBLE_SIZE,
      borderRadius: BUBBLE_SIZE / 2,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    bubbleIcon: {
      fontSize: 28,
    },

    // Modal - 使用固定尺寸，避免键盘弹出时 viewport 变化
    modalContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end', // 靠底部对齐
      alignItems: 'center',
      paddingBottom: 20, // 基础底部间距
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },

    // 聊天窗口 - 固定高度
    chatWindow: {
      width: CHAT_WIDTH,
      height: CHAT_HEIGHT,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 16,
      overflow: 'hidden',
    },

    // Header
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    chatTitle: {
      fontSize: typography.base,
      fontWeight: '600',
      color: colors.text,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    headerBtn: {
      padding: spacing.xs,
    },
    headerBtnText: {
      fontSize: 16,
    },

    // Messages
    messageList: {
      flex: 1,
    },
    messageListContent: {
      padding: spacing.sm,
    },
    messageRow: {
      marginBottom: spacing.xs,
      flexDirection: 'row',
    },
    messageRowUser: {
      justifyContent: 'flex-end',
    },
    messageBubble: {
      maxWidth: '85%',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
    },
    userBubble: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    assistantBubble: {
      backgroundColor: colors.background,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: typography.sm,
      color: colors.text,
      lineHeight: 20,
    },
    userText: {
      color: colors.textInverse,
    },

    // Input
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      minHeight: 36,
      maxHeight: 80,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: 16, // 必须 >= 16px，否则 iOS Safari 会自动缩放
      color: colors.text,
      marginRight: spacing.xs,
    },
    sendButton: {
      width: 36,
      height: 36,
      backgroundColor: colors.primary,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      color: colors.textInverse,
      fontWeight: '700',
      fontSize: 18,
    },

    // Empty
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    emptyText: {
      fontSize: typography.sm,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
  });

export default AIChatBubble;
