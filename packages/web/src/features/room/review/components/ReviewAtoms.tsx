/**
 * Shared report atoms: the seat medal (the one carrier of a seat number
 * outside running text), the tag pill, and an inline line.
 */
import type React from 'react';

import type { ReviewInline, ReviewTone } from '../types';

export type ReportMedalSize = 'stamp' | 'roster' | 'inline';

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
  return (
    <span
      className="review-medal"
      data-size={size}
      data-tone={tone}
      data-stamped={isStamped}
      role="img"
      aria-label={`${seat + 1}号`}
    >
      {seat + 1}
    </span>
  );
}

export function ReviewTag({ text, tone }: { readonly text: string; readonly tone: ReviewTone }) {
  return (
    <span className="review-tag" data-tone={tone}>
      {text}
    </span>
  );
}

type TextInline = Extract<ReviewInline, { readonly kind: 'text' }>;

type InlineSegment =
  | { readonly kind: 'sentence'; readonly runs: readonly TextInline[] }
  | { readonly kind: 'atom'; readonly inline: Exclude<ReviewInline, { readonly kind: 'text' }> };

/** Consecutive text inlines join one sentence so the words wrap as prose. */
function segmentInlines(inlines: readonly ReviewInline[]): readonly InlineSegment[] {
  const segments: InlineSegment[] = [];
  for (const inline of inlines) {
    if (inline.kind !== 'text') {
      segments.push({ kind: 'atom', inline });
      continue;
    }
    const last = segments.at(-1);
    if (last?.kind === 'sentence') {
      segments[segments.length - 1] = { kind: 'sentence', runs: [...last.runs, inline] };
    } else {
      segments.push({ kind: 'sentence', runs: [inline] });
    }
  }
  return segments;
}

function Sentence({ runs }: { readonly runs: readonly TextInline[] }) {
  return (
    <span className="review-sentence">
      {runs.map((run, index) =>
        run.tone === 'neutral' ? (
          run.text
        ) : (
          <span key={index} className="review-toned" data-tone={run.tone}>
            {run.text}
          </span>
        ),
      )}
    </span>
  );
}

/**
 * One line of inline content. A line of words alone is a single sentence
 * that fills the line; a line with medals or tags wraps its elements.
 */
export function ReviewInlineLine({
  inlines,
}: {
  readonly inlines: readonly ReviewInline[];
}): React.ReactElement {
  const segments = segmentInlines(inlines);
  const [only] = segments;
  if (segments.length === 1 && only?.kind === 'sentence') {
    return (
      <p className="review-line">
        <Sentence runs={only.runs} />
      </p>
    );
  }
  return (
    <p className="review-line" data-wrap="true">
      {segments.map((segment, index) => {
        if (segment.kind === 'sentence') return <Sentence key={index} runs={segment.runs} />;
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
    </p>
  );
}
