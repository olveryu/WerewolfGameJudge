/**
 * SimpleMarkdown - 轻量 Markdown 渲染组件
 *
 * 专为 AI 聊天气泡设计（~150 字短文本），只处理常见格式：
 * - **加粗**
 * - 无序列表（- / * / •）
 * - 有序列表（1. 2. 3.）
 * - 换行
 *
 * 不引入完整 markdown 库（过度）。
 *
 * ✅ 允许：纯 UI 渲染、接收 theme colors
 * ❌ 禁止：import service / 业务逻辑
 */

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { spacing, typography, type ThemeColors } from '@/theme';

interface SimpleMarkdownProps {
  content: string;
  colors: ThemeColors;
  /** 是否反色文字（用于用户消息气泡） */
  inverted?: boolean;
}

/**
 * 将一行文本中的 **bold** 解析为 <Text style={bold}> 片段
 */
function renderInlineFormatting(
  line: string,
  baseStyle: object,
  boldStyle: object,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // 匹配 **text** 或 __text__
  const boldRegex = /(\*\*|__)(.+?)\1/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(line)) !== null) {
    // 前面的普通文本
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t-${lastIndex}`} style={baseStyle}>
          {line.slice(lastIndex, match.index)}
        </Text>,
      );
    }
    // 加粗文本
    parts.push(
      <Text key={`b-${match.index}`} style={[baseStyle, boldStyle]}>
        {match[2]}
      </Text>,
    );
    lastIndex = match.index + match[0].length;
  }

  // 剩余文本
  if (lastIndex < line.length) {
    parts.push(
      <Text key={`t-${lastIndex}`} style={baseStyle}>
        {line.slice(lastIndex)}
      </Text>,
    );
  }

  return parts.length > 0 ? parts : [<Text key="full" style={baseStyle}>{line}</Text>];
}

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({
  content,
  colors,
  inverted = false,
}) => {
  const textColor = inverted ? colors.textInverse : colors.text;
  const baseStyle = { fontSize: typography.secondary, color: textColor, lineHeight: 20 };
  const boldStyle = { fontWeight: typography.weights.bold };
  const bulletStyle = { color: textColor, fontSize: typography.secondary, marginRight: spacing.tight };

  const lines = content.split('\n');

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const lineKey = `md-${i}-${trimmed.slice(0, 12)}`;

        // 空行
        if (!trimmed) {
          return <View key={lineKey} style={localStyles.emptyLine} />;
        }

        // 无序列表：- / * / •
        const unorderedMatch = /^[-*•]\s+(.+)/.exec(trimmed);
        if (unorderedMatch) {
          return (
            <View key={lineKey} style={localStyles.listItem}>
              <Text style={bulletStyle}>•</Text>
              <Text style={localStyles.listText}>
                {renderInlineFormatting(unorderedMatch[1], baseStyle, boldStyle)}
              </Text>
            </View>
          );
        }

        // 有序列表：1. / 2. / 3.
        const orderedMatch = /^(\d+)[.)]\s+(.+)/.exec(trimmed);
        if (orderedMatch) {
          return (
            <View key={lineKey} style={localStyles.listItem}>
              <Text style={bulletStyle}>{orderedMatch[1]}.</Text>
              <Text style={localStyles.listText}>
                {renderInlineFormatting(orderedMatch[2], baseStyle, boldStyle)}
              </Text>
            </View>
          );
        }

        // 普通段落
        return (
          <Text key={lineKey} style={baseStyle}>
            {renderInlineFormatting(trimmed, baseStyle, boldStyle)}
          </Text>
        );
      })}
    </View>
  );
};

const localStyles = StyleSheet.create({
  emptyLine: {
    height: spacing.small,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
    paddingLeft: spacing.tight,
  },
  listText: {
    flex: 1,
    flexWrap: 'wrap',
  },
});
