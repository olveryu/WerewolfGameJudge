/**
 * Shared report atoms: the seat medal (the one carrier of a seat number
 * outside running text), the tag pill, and an inline line.
 */

import type React from 'react';
import { type StyleProp, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, typography } from '@/theme';

import {
  REPORT_ACCENT_COLORS,
  REPORT_MEDAL_SIZES,
  REPORT_SWATCHES,
  REPORT_TEXT_COLORS,
  type ReportMedalSize,
} from '../reportTheme';
import type { ReviewInline, ReviewTone } from '../types';

const MEDAL_TEXT_SIZES: Readonly<Record<ReportMedalSize, number>> = {
  stamp: typography.title,
  roster: typography.caption,
  inline: typography.caption,
};

/**
 * A seat number in a medal. A stamped medal is filled with the tone's
 * accent (a death stamp, a podium place); a plain one wears the swatch.
 */
export function SeatMedal({
  seat,
  size,
  tone,
  isStamped,
}: {
  readonly seat: number;
  readonly size: ReportMedalSize;
  readonly tone: ReviewTone;
  readonly isStamped: boolean;
}) {
  const swatch = REPORT_SWATCHES[tone];
  const diameter = REPORT_MEDAL_SIZES[size];
  const fill = isStamped ? REPORT_ACCENT_COLORS[tone] : swatch.bg;
  return (
    <View
      style={[
        styles.medal,
        {
          width: diameter,
          height: diameter,
          backgroundColor: fill,
          borderColor: isStamped ? fill : swatch.border,
        },
      ]}
      accessible
      accessibilityLabel={`${seat + 1}号`}
    >
      <Text
        style={[
          styles.medalText,
          {
            fontSize: MEDAL_TEXT_SIZES[size],
            color: isStamped ? colors.textInverse : swatch.text,
          },
        ]}
      >
        {seat + 1}
      </Text>
    </View>
  );
}

export function ReviewTag({ text, tone }: { readonly text: string; readonly tone: ReviewTone }) {
  const swatch = REPORT_SWATCHES[tone];
  return (
    <View style={[styles.tag, { backgroundColor: swatch.bg, borderColor: swatch.border }]}>
      <Text style={[styles.tagText, { color: swatch.text }]}>{text}</Text>
    </View>
  );
}

type InlineSegment =
  | {
      readonly kind: 'sentence';
      readonly runs: readonly Extract<ReviewInline, { readonly kind: 'text' }>[];
    }
  | { readonly kind: 'atom'; readonly inline: Exclude<ReviewInline, { readonly kind: 'text' }> };

/** Consecutive text inlines join one sentence so the words wrap as prose. */
function segmentInlines(inlines: readonly ReviewInline[]): readonly InlineSegment[] {
  const segments: InlineSegment[] = [];
  for (const inline of inlines) {
    if (inline.kind !== 'text') {
      segments.push({ kind: 'atom', inline });
      continue;
    }
    const last = segments[segments.length - 1];
    if (last?.kind === 'sentence') {
      segments[segments.length - 1] = { kind: 'sentence', runs: [...last.runs, inline] };
    } else {
      segments.push({ kind: 'sentence', runs: [inline] });
    }
  }
  return segments;
}

function Sentence({
  runs,
  style,
}: {
  readonly runs: readonly Extract<ReviewInline, { readonly kind: 'text' }>[];
  readonly style: StyleProp<TextStyle>;
}) {
  return (
    <Text style={style}>
      {runs.map((run, index) => (
        <Text
          key={index}
          style={run.tone === 'neutral' ? undefined : { color: REPORT_TEXT_COLORS[run.tone] }}
        >
          {run.text}
        </Text>
      ))}
    </Text>
  );
}

/**
 * One line of inline content. A line of words alone is a single sentence
 * that fills the line; a line with medals or tags wraps its elements.
 */
export function ReviewInlineLine({
  inlines,
  textStyle,
}: {
  readonly inlines: readonly ReviewInline[];
  readonly textStyle: StyleProp<TextStyle>;
}): React.ReactElement {
  const segments = segmentInlines(inlines);
  const [only] = segments;
  if (segments.length === 1 && only?.kind === 'sentence') {
    return <Sentence runs={only.runs} style={textStyle} />;
  }
  return (
    <View style={styles.wrapLine}>
      {segments.map((segment, index) => {
        if (segment.kind === 'sentence') {
          return <Sentence key={index} runs={segment.runs} style={[textStyle, styles.shrink]} />;
        }
        const { inline } = segment;
        return inline.kind === 'seat' ? (
          <SeatMedal
            key={index}
            seat={inline.seat}
            size="inline"
            tone={inline.tone}
            isStamped={false}
          />
        ) : (
          <ReviewTag key={index} text={inline.text} tone={inline.tone} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  medal: {
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  tag: {
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  tagText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  shrink: {
    flexShrink: 1,
  },
  wrapLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.tight,
  },
});
