/**
 * 猜词消息流：只渲染聊天式猜词记录，内部滚动。
 *
 * 猜中者的答案对其他猜题者隐藏：view model 里 text 为 null 时只显示「xxx 猜中了」。
 * 输入行已拆到 DrawGuessGuessComposer，作画视图把输入行钉在任务框底部，
 * 本组件只占剩余高度并随键盘弹起先收缩。
 */

import type { DrawGuessViewModel } from '@game-judge/game-engine/games/drawguess/public';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

type DrawGuessGuessMessage = DrawGuessViewModel['messages'][number];

interface DrawGuessGuessLogProps {
  readonly messages: readonly DrawGuessGuessMessage[];
  readonly viewerSeat: number | null;
}

function GuessMessageRow({
  message,
  viewerSeat,
}: {
  readonly message: DrawGuessGuessMessage;
  readonly viewerSeat: number | null;
}) {
  if (message.correct && message.seat === viewerSeat) {
    return (
      <View style={[styles.messageRow, styles.ownCorrectRow]}>
        <Text style={styles.ownCorrectText}>🎉 你猜中了！</Text>
      </View>
    );
  }
  if (message.correct) {
    return (
      <View style={[styles.messageRow, styles.otherCorrectRow]}>
        <Text style={styles.otherCorrectText}>
          🎯 {message.displayName} 猜中了{message.text === null ? '' : `：${message.text}`}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.messageRow}>
      <Text style={styles.messageText}>
        <Text style={styles.messageName}>{message.displayName}：</Text>
        {message.text ?? ''}
      </Text>
    </View>
  );
}

/** 聊天式猜词记录；只在用户位于底部附近时自动滚动到底。 */
export const DrawGuessGuessLog: React.FC<DrawGuessGuessLogProps> = ({ messages, viewerSeat }) => {
  const listRef = useRef<FlatList<DrawGuessGuessMessage>>(null);
  // 用户是否在底部附近：只有在底部时才自动滚，不打扰翻看历史的用户
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    if (messages.length > 0 && isNearBottomRef.current) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => `${message.seat}:${message.at}`}
        renderItem={({ item }) => <GuessMessageRow message={item} viewerSeat={viewerSeat} />}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        accessibilityLabel="猜词消息"
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const distanceFromBottom =
            contentSize.height - contentOffset.y - layoutMeasurement.height;
          // 40px 容差：用户在底部附近才算"在底部"
          isNearBottomRef.current = distanceFromBottom < 40;
        }}
        scrollEventThrottle={100}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
  messageList: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  messageListContent: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.small,
    gap: spacing.tight,
  },
  messageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  messageText: {
    ...textStyles.secondary,
    color: colors.text,
  },
  messageName: {
    ...textStyles.secondarySemibold,
    color: colors.text,
  },
  otherCorrectRow: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderWidth: fixed.borderWidth,
    borderColor: colors.success,
  },
  otherCorrectText: {
    ...textStyles.secondarySemibold,
    color: colors.success,
  },
  ownCorrectRow: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
    borderWidth: fixed.borderWidth,
    borderColor: colors.primary,
  },
  ownCorrectText: {
    ...textStyles.secondarySemibold,
    color: colors.primary,
  },
});
