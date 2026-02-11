/**
 * AIChatBubble - 全局悬浮聊天泡泡
 *
 * 在右下角显示一个可拖动的悬浮按钮，点击后弹出聊天窗口。
 * 支持 streaming 流式输出、消息长按操作、scroll-to-bottom、
 * typing indicator、触觉反馈等。
 *
 * 逻辑层：useAIChat.ts（编排 → useBubbleDrag / useKeyboardHeight / useChatMessages）
 * 样式层：AIChatBubble.styles.ts
 *
 * ✅ 允许：渲染聊天 UI、通过 useAIChat hook 交互
 * ❌ 禁止：直接 import service / 直接调用 API
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { useTheme } from '@/theme';

import { createStyles, type DisplayMessage, getChatHeight } from './AIChatBubble.styles';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { useAIChat } from './useAIChat';

/** Distance from bottom to show scroll-to-bottom FAB */
const SCROLL_THRESHOLD = 100;

export const AIChatBubble: React.FC = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const flatListRef = useRef<FlatList>(null);
  const { height: screenHeight } = useWindowDimensions();
  const chatHeight = getChatHeight(screenHeight);

  const chat = useAIChat();

  // ── Scroll-to-bottom state ─────────────────────────
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollBtn(distFromBottom > SCROLL_THRESHOLD);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  // Auto-scroll when new content arrives (streaming or new message)
  const handleContentSizeChange = useCallback(() => {
    if (!showScrollBtn) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [showScrollBtn]);

  // ── Message renderer ───────────────────────────────
  const renderMessage = useCallback(
    ({ item }: { item: DisplayMessage }) => {
      const isUser = item.role === 'user';
      return (
        <MessageBubble
          message={item}
          colors={colors}
          bubbleStyle={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
          textStyle={[styles.messageText, isUser && styles.userText]}
          onRetry={chat.handleRetry}
        />
      );
    },
    [styles, colors, chat.handleRetry],
  );

  // Web drag style
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webDragStyle: any =
    Platform.OS === 'web'
      ? { touchAction: 'none', cursor: 'grab', userSelect: 'none' }
      : {};

  return (
    <>
      {/* ── Floating bubble ─────────────────────────── */}
      <Animated.View
        style={[
          styles.bubbleContainer,
          {
            left: chat.position.x,
            top: chat.position.y,
            transform: [{ scale: chat.scaleAnim }],
          },
          webDragStyle,
        ]}
        onTouchStart={chat.handleTouchStart}
        onTouchMove={chat.handleTouchMove}
        onTouchEnd={chat.handleTouchEnd}
      >
        <TouchableOpacity
          style={styles.bubble}
          onPress={chat.handleBubblePress}
          activeOpacity={0.8}
        >
          <Text style={styles.bubbleIcon}>🐺</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Chat Modal ──────────────────────────────── */}
      <Modal
        visible={chat.isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => chat.setIsOpen(false)}
      >
        <View
          style={[styles.modalContainer, { paddingBottom: chat.keyboardHeight + 10 }]}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => chat.setIsOpen(false)}
          />

          <View style={[styles.chatWindow, { height: chatHeight }]}>
            {/* Header */}
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>🐺 狼人杀助手</Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  onPress={chat.handleClearHistory}
                  style={styles.headerBtn}
                >
                  <Text style={styles.headerBtnText}>🗑️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => chat.setIsOpen(false)}
                  style={styles.headerBtn}
                >
                  <Text style={styles.headerBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <View style={styles.messageListWrapper}>
              <FlatList
                ref={flatListRef}
                data={chat.messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                onContentSizeChange={handleContentSizeChange}
                onScroll={handleScroll}
                scrollEventThrottle={100}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      👋 你好！我是狼人杀助手{'\n'}
                      可以问我游戏规则、策略建议等
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  chat.isStreaming && chat.messages.at(-1)?.content === '' ? (
                    <TypingIndicator colors={colors} />
                  ) : null
                }
              />

              {/* Scroll-to-bottom FAB */}
              {showScrollBtn && (
                <TouchableOpacity
                  style={[styles.scrollToBottomBtn, { backgroundColor: colors.surface }]}
                  onPress={scrollToBottom}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.scrollToBottomText, { color: colors.text }]}>↓</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick questions */}
            <View style={styles.quickQuestionsContainer}>
              {chat.contextQuestions.slice(0, 4).map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[
                    styles.quickQuestionBtn,
                    chat.isLoading && styles.quickQuestionBtnDisabled,
                  ]}
                  onPress={() => chat.handleQuickQuestion(q)}
                  activeOpacity={chat.isLoading ? 1 : 0.7}
                  accessibilityState={{ disabled: chat.isLoading }}
                >
                  <Text style={styles.quickQuestionText} numberOfLines={1}>
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="输入消息..."
                placeholderTextColor={colors.textMuted}
                value={chat.inputText}
                onChangeText={chat.setInputText}
                multiline
                maxLength={500}
                editable={!chat.isLoading}
                returnKeyType="send"
                onSubmitEditing={chat.handleSend}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!chat.inputText.trim() ||
                    chat.isLoading ||
                    chat.cooldownRemaining > 0) &&
                    styles.sendButtonDisabled,
                ]}
                onPress={chat.handleSend}
                activeOpacity={
                  !chat.inputText.trim() ||
                  chat.isLoading ||
                  chat.cooldownRemaining > 0
                    ? 1
                    : 0.7
                }
                accessibilityState={{
                  disabled:
                    !chat.inputText.trim() ||
                    chat.isLoading ||
                    chat.cooldownRemaining > 0,
                }}
              >
                {(() => {
                  if (chat.isLoading) {
                    return <ActivityIndicator size="small" color="#fff" />;
                  }
                  if (chat.cooldownRemaining > 0) {
                    return (
                      <Text style={styles.sendButtonText}>
                        {chat.cooldownRemaining}
                      </Text>
                    );
                  }
                  return <Text style={styles.sendButtonText}>↑</Text>;
                })()}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};
