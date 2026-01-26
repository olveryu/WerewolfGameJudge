/**
 * AI Chat Bubble - 全局悬浮聊天泡泡
 *
 * 在右下角显示一个悬浮按钮，点击后弹出聊天窗口
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  KeyboardAvoidingView,
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
import { sendChatMessage, ChatMessage, getDefaultApiKey, hasApiKey } from '../../services/AIChatService';
import { showAlert } from '../../utils/alert';

const STORAGE_KEY_API_KEY = '@ai_chat_github_token';
const STORAGE_KEY_MESSAGES = '@ai_chat_messages';
const STORAGE_KEY_POSITION = '@ai_chat_bubble_position';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CHAT_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
const CHAT_HEIGHT = Math.min(SCREEN_HEIGHT * 0.6, 500);
const BUBBLE_SIZE = 56;
const BUBBLE_MARGIN = 16;

// 默认位置：右下角
const DEFAULT_POSITION = {
  x: SCREEN_WIDTH - BUBBLE_SIZE - BUBBLE_MARGIN,
  y: SCREEN_HEIGHT - BUBBLE_SIZE - 60, // 降低位置，距离底部 60
};

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const AIChatBubble: React.FC = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const flatListRef = useRef<FlatList>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // 拖动位置状态
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 优先使用环境变量中的 API Key
  const [apiKey, setApiKey] = useState(getDefaultApiKey());
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(getDefaultApiKey());
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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
  }, [position]);

  // 监听键盘
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // 加载保存的 API Key 和消息（仅当环境变量未配置时才读取存储的 key）
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedKey, savedMessages, savedPosition] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_API_KEY),
          AsyncStorage.getItem(STORAGE_KEY_MESSAGES),
          AsyncStorage.getItem(STORAGE_KEY_POSITION),
        ]);
        // 只有在没有默认 API Key 时才使用存储的 key
        if (!hasApiKey() && savedKey) {
          setApiKey(savedKey);
          setTempApiKey(savedKey);
        }
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        }
        // 加载保存的位置
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

  const handleBubblePress = useCallback(() => {
    // 按钮动画
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setIsOpen(true);
  }, [scaleAnim]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    if (!apiKey) {
      setShowSettings(true);
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

    // 构建上下文（最近 10 条消息）
    const contextMessages: ChatMessage[] = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    contextMessages.push({ role: 'user', content: text });

    const response = await sendChatMessage(contextMessages, apiKey);

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

  const handleSaveApiKey = useCallback(async () => {
    const key = tempApiKey.trim();
    if (!key) {
      showAlert('请输入 GitHub Token', '');
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY_API_KEY, key);
    setApiKey(key);
    setShowSettings(false);
    showAlert('保存成功', 'GitHub Token 已保存');
  }, [tempApiKey]);

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

  // 设置面板
  const renderSettings = () => (
    <View style={styles.settingsPanel}>
      <Text style={styles.settingsTitle}>⚙️ 配置 GitHub Token</Text>
      <Text style={styles.settingsHint}>
        获取方式：GitHub → Settings → Developer settings → Personal access tokens → Generate new token
        (classic)，无需勾选权限
      </Text>
      <TextInput
        style={styles.apiKeyInput}
        placeholder="ghp_xxxxxxxxxxxx"
        placeholderTextColor={colors.textMuted}
        value={tempApiKey}
        onChangeText={setTempApiKey}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <View style={styles.settingsButtons}>
        <TouchableOpacity
          style={[styles.settingsBtn, styles.cancelBtn]}
          onPress={() => setShowSettings(false)}
        >
          <Text style={styles.cancelBtnText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingsBtn, styles.saveBtn]} onPress={handleSaveApiKey}>
          <Text style={styles.saveBtnText}>保存</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Web 专用样式：阻止拖动时页面滚动
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webDragStyle: any = Platform.OS === 'web' ? { touchAction: 'none', cursor: 'grab', userSelect: 'none' } : {};

  return (
    <>
      {/* 悬浮按钮 - 可拖动 */}
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
        <View style={styles.bubble}>
          <Text style={styles.bubbleIcon}>🐺</Text>
        </View>
      </Animated.View>

      {/* 聊天窗口 Modal */}
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContainer}
          enabled={Platform.OS !== 'web'}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsOpen(false)} />

          <View
            style={[
              styles.chatWindow,
              // 只在 iOS 上根据键盘高度调整位置，Web 上固定位置
              Platform.OS === 'ios' && keyboardHeight > 0
                ? { bottom: keyboardHeight + 10 }
                : { bottom: 90 },
            ]}
          >
            {showSettings ? (
              renderSettings()
            ) : (
              <>
                {/* Header */}
                <View style={styles.chatHeader}>
                  <Text style={styles.chatTitle}>🐺 狼人杀助手</Text>
                  <View style={styles.headerButtons}>
                    <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerBtn}>
                      <Text style={styles.headerBtnText}>⚙️</Text>
                    </TouchableOpacity>
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
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        👋 你好！我是狼人杀助手{'\n'}
                        可以问我游戏规则、策略建议等
                      </Text>
                      {!apiKey && (
                        <TouchableOpacity style={styles.setupBtn} onPress={() => setShowSettings(true)}>
                          <Text style={styles.setupBtnText}>⚙️ 点击配置 GitHub Token</Text>
                        </TouchableOpacity>
                      )}
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
              </>
            )}
          </View>
        </KeyboardAvoidingView>
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

    // Modal
    modalContainer: {
      flex: 1,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },

    // 聊天窗口
    chatWindow: {
      position: 'absolute',
      right: 16,
      width: CHAT_WIDTH,
      height: CHAT_HEIGHT,
      maxHeight: CHAT_HEIGHT,
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
      fontSize: typography.sm,
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
    setupBtn: {
      marginTop: spacing.md,
      padding: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    setupBtnText: {
      color: colors.textInverse,
      fontSize: typography.sm,
      fontWeight: '500',
    },

    // Settings
    settingsPanel: {
      flex: 1,
      padding: spacing.md,
    },
    settingsTitle: {
      fontSize: typography.base,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    settingsHint: {
      fontSize: typography.xs,
      color: colors.textMuted,
      marginBottom: spacing.md,
      lineHeight: 18,
    },
    apiKeyInput: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      fontSize: typography.sm,
      color: colors.text,
      marginBottom: spacing.md,
    },
    settingsButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    settingsBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    cancelBtn: {
      backgroundColor: colors.background,
    },
    cancelBtnText: {
      color: colors.text,
      fontWeight: '500',
    },
    saveBtn: {
      backgroundColor: colors.primary,
    },
    saveBtnText: {
      color: colors.textInverse,
      fontWeight: '600',
    },
  });

export default AIChatBubble;
