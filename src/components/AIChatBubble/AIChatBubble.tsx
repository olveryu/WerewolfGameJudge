/**
 * AIChatBubble - 全局悬浮聊天泡泡
 *
 * 在右下角显示一个悬浮按钮，点击后弹出聊天窗口
 * 使用 visualViewport API (Web) 处理键盘弹出
 * 支持读取游戏上下文（玩家视角，不作弊）
 *
 * 逻辑层：useAIChat.ts
 * 样式层：AIChatBubble.styles.ts
 *
 * ✅ 允许：渲染聊天 UI、通过 useAIChat hook 交互
 * ❌ 禁止：直接 import service / 直接调用 API
 */

import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '@/theme';
import { useAIChat } from './useAIChat';
import { createStyles, getChatHeight, type DisplayMessage } from './AIChatBubble.styles';
import { SimpleMarkdown } from './SimpleMarkdown';

export const AIChatBubble: React.FC = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const flatListRef = useRef<FlatList>(null);
  const { height: screenHeight } = useWindowDimensions();
  const chatHeight = getChatHeight(screenHeight);

  const chat = useAIChat();

  const renderMessage = useCallback(
    ({ item }: { item: DisplayMessage }) => {
      const isUser = item.role === 'user';
      return (
        <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            {isUser ? (
              <Text style={[styles.messageText, styles.userText]}>
                {item.content}
              </Text>
            ) : (
              <SimpleMarkdown content={item.content} colors={colors} />
            )}
          </View>
        </View>
      );
    },
    [styles, colors],
  );

  // Web 专用样式：阻止拖动时页面滚动
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webDragStyle: any =
    Platform.OS === 'web'
      ? { touchAction: 'none', cursor: 'grab', userSelect: 'none' }
      : {};

  return (
    <>
      {/* 悬浮按钮 - 可拖动，支持 Web 桌面点击 */}
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
        {/* 用 TouchableOpacity 包裹，确保 Web 桌面端鼠标点击生效 */}
        <TouchableOpacity
          style={styles.bubble}
          onPress={chat.handleBubblePress}
          activeOpacity={0.8}
        >
          <Text style={styles.bubbleIcon}>🐺</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* 聊天窗口 Modal */}
      <Modal
        visible={chat.isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => chat.setIsOpen(false)}
      >
        {/* 使用 paddingBottom 来避开键盘 */}
        <View
          style={[
            styles.modalContainer,
            { paddingBottom: chat.keyboardHeight + 10 },
          ]}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => chat.setIsOpen(false)}
          />

          {/* 响应式高度 */}
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
            <FlatList
              ref={flatListRef}
              data={chat.messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
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

            {/* 快捷问题 - AI 建议 + 上下文问题 */}
            <View style={styles.quickQuestionsContainer}>
              {/* 优先显示 AI 生成的跟进问题 */}
              {chat.aiSuggestions.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[
                    styles.quickQuestionBtn,
                    styles.aiSuggestionBtn,
                    chat.isLoading && styles.quickQuestionBtnDisabled,
                  ]}
                  onPress={() => chat.handleQuickQuestion(q)}
                  activeOpacity={chat.isLoading ? 1 : 0.7}
                  accessibilityState={{ disabled: chat.isLoading }}
                >
                  <Text
                    style={[
                      styles.quickQuestionText,
                      styles.aiSuggestionText,
                    ]}
                    numberOfLines={1}
                  >
                    💬 {q}
                  </Text>
                </TouchableOpacity>
              ))}
              {/* 补充上下文问题（最多补到 4 个） */}
              {chat.contextQuestions
                .filter((q) => !chat.aiSuggestions.includes(q))
                .slice(0, Math.max(0, 4 - chat.aiSuggestions.length))
                .map((q) => (
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
                    return (
                      <ActivityIndicator size="small" color="#fff" />
                    );
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
