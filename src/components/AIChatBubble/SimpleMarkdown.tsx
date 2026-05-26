/**
 * SimpleMarkdown - lightweight Markdown rendering component
 *
 * Designed for AI chat bubbles (~150-char short text), handles common formats:
 * - **bold**
 * - `inline code`
 * - ```code blocks```
 * - # / ## / ### headings
 * - Unordered list (- / * / •)
 * - Ordered list (1. 2. 3.)
 * - Line breaks
 *
 * Does not pull in a full markdown library (overkill).
 * Pure UI rendering; accepts theme colors. Does not import services and contains no business logic.
 */

import type React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, spacing, type ThemeColors, typography, withAlpha } from '@/theme';

interface SimpleMarkdownProps {
  content: string;
  colors: ThemeColors;
  /** Whether to use inverted text color (used for user message bubbles) */
  inverted?: boolean;
}

/**
 * Parses **bold** and `code` in a single line into styled fragments
 */
function renderInlineFormatting(
  line: string,
  baseStyle: object,
  boldStyle: object,
  codeStyle: object,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Matches **bold**, __bold__, `code`
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

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ content, inverted = false }) => {
  const textColor = inverted ? colors.textInverse : colors.text;
  const baseStyle = {
    fontSize: typography.secondary,
    color: textColor,
    lineHeight: typography.lineHeights.secondary,
  };
  const boldStyle = { fontWeight: typography.weights.bold };
  const codeStyle = {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: inverted ? withAlpha('#FFFFFF', 0.15) : withAlpha('#000000', 0.06),
    borderRadius: borderRadius.none + 3,
    paddingHorizontal: spacing.micro,
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
    const line = lines[i]!;
    const trimmed = line.trim();
    const lineKey = `md-${i}`;

    // ── Code block: ``` ──────────────────────────────
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++; // skip opening ```
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
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
      const level = headerMatch[1]!.length as 1 | 2 | 3;
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
          {headerMatch[2]!}
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
            {renderInlineFormatting(unorderedMatch[1]!, baseStyle, boldStyle, codeStyle)}
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
          <Text style={bulletStyle}>{orderedMatch[1]!}.</Text>
          <Text style={localStyles.listText}>
            {renderInlineFormatting(orderedMatch[2]!, baseStyle, boldStyle, codeStyle)}
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
    marginBottom: spacing.micro,
  },
  emptyLine: {
    height: spacing.small,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.micro,
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
    lineHeight: typography.lineHeights.secondary - 2,
    padding: spacing.small,
    borderRadius: borderRadius.small,
    overflow: 'hidden',
  },
  codeBlockBgInverted: {
    backgroundColor: withAlpha('#FFFFFF', 0.1),
  },
  codeBlockBgNormal: {
    backgroundColor: withAlpha('#000000', 0.04),
  },
});
