/**
 * SimpleMarkdown - 轻量 Markdown 渲染组件
 *
 * 专为 AI 聊天气泡设计（~150 字短文本），处理常见格式：
 * - **加粗**
 * - `inline code`
 * - ```code blocks```
 * - # / ## / ### 标题
 * - 无序列表（- / * / •）
 * - 有序列表（1. 2. 3.）
 * - 换行
 *
 * 不引入完整 markdown 库（过度）。
 * 纯 UI 渲染，接收 theme colors。不 import service，不含业务逻辑。
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { borderRadius, spacing, type ThemeColors, typography } from '@/theme';

interface SimpleMarkdownProps {
  content: string;
  colors: ThemeColors;
  /** 是否反色文字（用于用户消息气泡） */
  inverted?: boolean;
}

/**
 * 将一行文本中的 **bold** 和 `code` 解析为带样式的片段
 */
function renderInlineFormatting(
  line: string,
  baseStyle: object,
  boldStyle: object,
  codeStyle: object,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // 匹配 **bold**、__bold__、`code`
  const inlineRegex = /(\*\*|__)(.+?)\1|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(line)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t-${lastIndex}`} style={baseStyle}>
          {line.slice(lastIndex, match.index)}
        </Text>,
      );
    }

    if (match[3]) {
      // Inline code: `code`
      parts.push(
        <Text key={`c-${match.index}`} style={[baseStyle, codeStyle]}>
          {match[3]}
        </Text>,
      );
    } else {
      // Bold: **text**
      parts.push(
        <Text key={`b-${match.index}`} style={[baseStyle, boldStyle]}>
          {match[2]}
        </Text>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < line.length) {
    parts.push(
      <Text key={`t-${lastIndex}`} style={baseStyle}>
        {line.slice(lastIndex)}
      </Text>,
    );
  }

  return parts.length > 0
    ? parts
    : [
        <Text key="full" style={baseStyle}>
          {line}
        </Text>,
      ];
}

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({
  content,
  colors,
  inverted = false,
}) => {
  const textColor = inverted ? colors.textInverse : colors.text;
  const baseStyle = { fontSize: typography.secondary, color: textColor, lineHeight: 20 };
  const boldStyle = { fontWeight: typography.weights.bold };
  const codeStyle = {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: inverted ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    paddingHorizontal: 3,
    fontSize: typography.secondary - 1,
  };
  const bulletStyle = {
    color: textColor,
    fontSize: typography.secondary,
    marginRight: spacing.tight,
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineKey = `md-${i}`;

    // ── Code block: ``` ──────────────────────────────
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++; // skip opening ```
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```

      elements.push(
        <View key={lineKey} style={localStyles.codeBlock}>
          <Text
            style={[
              localStyles.codeBlockText,
              inverted ? localStyles.codeBlockBgInverted : localStyles.codeBlockBgNormal,
              { color: textColor },
            ]}
          >
            {codeLines.join('\n')}
          </Text>
        </View>,
      );
      continue;
    }

    // ── Empty line ──────────────────────────────────
    if (!trimmed) {
      elements.push(<View key={lineKey} style={localStyles.emptyLine} />);
      i++;
      continue;
    }

    // ── Headers: # / ## / ### ───────────────────────
    const headerMatch = /^(#{1,3})\s+(.+)/.exec(trimmed);
    if (headerMatch) {
      const level = headerMatch[1].length as 1 | 2 | 3;
      const sizes = { 1: typography.subtitle + 2, 2: typography.subtitle, 3: typography.body };
      elements.push(
        <Text
          key={lineKey}
          style={[
            baseStyle,
            localStyles.headerText,
            {
              fontSize: sizes[level],
            },
          ]}
        >
          {headerMatch[2]}
        </Text>,
      );
      i++;
      continue;
    }

    // ── Unordered list: - / * / • ───────────────────
    const unorderedMatch = /^[-*•]\s+(.+)/.exec(trimmed);
    if (unorderedMatch) {
      elements.push(
        <View key={lineKey} style={localStyles.listItem}>
          <Text style={bulletStyle}>•</Text>
          <Text style={localStyles.listText}>
            {renderInlineFormatting(unorderedMatch[1], baseStyle, boldStyle, codeStyle)}
          </Text>
        </View>,
      );
      i++;
      continue;
    }

    // ── Ordered list: 1. / 2. / 3. ─────────────────
    const orderedMatch = /^(\d+)[.)]\s+(.+)/.exec(trimmed);
    if (orderedMatch) {
      elements.push(
        <View key={lineKey} style={localStyles.listItem}>
          <Text style={bulletStyle}>{orderedMatch[1]}.</Text>
          <Text style={localStyles.listText}>
            {renderInlineFormatting(orderedMatch[2], baseStyle, boldStyle, codeStyle)}
          </Text>
        </View>,
      );
      i++;
      continue;
    }

    // ── Normal paragraph ────────────────────────────
    elements.push(
      <Text key={lineKey} style={baseStyle}>
        {renderInlineFormatting(trimmed, baseStyle, boldStyle, codeStyle)}
      </Text>,
    );
    i++;
  }

  return <View>{elements}</View>;
};

const localStyles = StyleSheet.create({
  headerText: {
    fontWeight: typography.weights.bold,
    marginTop: spacing.tight,
    marginBottom: 2,
  },
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
  codeBlock: {
    marginVertical: spacing.tight,
  },
  codeBlockText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: typography.secondary - 1,
    lineHeight: 18,
    padding: spacing.small,
    borderRadius: borderRadius.small,
    overflow: 'hidden',
  },
  codeBlockBgInverted: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  codeBlockBgNormal: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
});
