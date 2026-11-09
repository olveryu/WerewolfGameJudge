/**
 * The block switch. Every kind of the closed vocabulary renders here; the
 * declared return type makes a kind without a renderer a type error.
 */
import type React from 'react';

import type {
  ReviewBlock,
  ReviewGroup,
  ReviewRosterRow,
  ReviewStamp,
  ReviewTimelineStep,
} from '../types';
import { ReviewInlineLine, ReviewTag, SeatMedal } from './ReviewAtoms';
import { ReviewImageBlock } from './ReviewImageBlock';

type BlockOf<TKind extends ReviewBlock['kind']> = Extract<ReviewBlock, { readonly kind: TKind }>;

/** The podium: the first three ranks wear the highlight swatch. */
const PODIUM_RANK_LIMIT = 3;

function Stamp({ stamp }: { readonly stamp: ReviewStamp }) {
  return (
    <div className="review-stamp" data-tone={stamp.tone}>
      <SeatMedal seat={stamp.seat} size="stamp" tone={stamp.tone} isStamped />
      <div className="review-stamp-body">
        <p className="review-stamp-title">{stamp.title}</p>
        <p className="review-stamp-caption review-toned" data-tone={stamp.tone}>
          {stamp.caption}
        </p>
        {stamp.note !== null && <p className="review-stamp-note">{stamp.note}</p>}
      </div>
    </div>
  );
}

function HeroBlock({ block }: { readonly block: BlockOf<'hero'> }) {
  return (
    <div className="review-hero">
      <h3 className="review-headline review-toned" data-tone={block.tone}>
        {block.headline.map((run, index) =>
          run.kind === 'text' ? (
            run.text
          ) : (
            <span key={index} className="review-figure review-toned" data-tone={run.tone}>
              {run.text}
            </span>
          ),
        )}
      </h3>
      {block.stamps.length > 0 && (
        <div className="review-stamps">
          {block.stamps.map((stamp) => (
            <Stamp key={stamp.seat} stamp={stamp} />
          ))}
        </div>
      )}
      {block.byline !== null && <p className="review-byline">{block.byline}</p>}
    </div>
  );
}

function Group({ group }: { readonly group: ReviewGroup }) {
  return (
    <div className="review-group">
      <div className="review-group-rail" data-tone={group.railTone} />
      <div className="review-group-inner">
        <div className="review-group-header">
          <p className="review-group-title">{group.title}</p>
          {group.tag !== null && <ReviewTag text={group.tag.text} tone={group.tag.tone} />}
        </div>
        {group.rows.map((row, index) => (
          <div key={index} data-dimmed={row.isDimmed}>
            <ReviewInlineLine inlines={row.cells} />
          </div>
        ))}
        {group.footnote !== null && <p className="review-footnote">{group.footnote}</p>}
      </div>
    </div>
  );
}

function RosterRow({ row }: { readonly row: ReviewRosterRow }) {
  return (
    <div className="review-roster-row" data-out={row.isOut}>
      <SeatMedal seat={row.seat} size="roster" tone={row.seatTone} isStamped={false} />
      {row.name === null ? (
        <span className="review-roster-primary">{row.role}</span>
      ) : (
        <span className="review-roster-identity">
          <span className="review-roster-primary">{row.name}</span>
          <span className="review-roster-role">{row.role}</span>
        </span>
      )}
      <span className="review-roster-status review-toned" data-tone={row.statusTone}>
        {row.status}
      </span>
    </div>
  );
}

function TimelineStep({ step }: { readonly step: ReviewTimelineStep }) {
  return (
    <li className="review-timeline-step">
      <span className="review-timeline-dot" data-tone={step.tone} />
      <div className="review-timeline-content">
        {step.title !== null && <p className="review-timeline-title">{step.title}</p>}
        {step.lines.map((line, index) => (
          <ReviewInlineLine key={index} inlines={line} />
        ))}
      </div>
    </li>
  );
}

export function ReviewBlockView({
  block,
  blockId,
}: {
  readonly block: ReviewBlock;
  /** Page-unique block identity, `${pageKey}/${index}`. */
  readonly blockId: string;
}): React.ReactElement {
  switch (block.kind) {
    case 'hero':
      return <HeroBlock block={block} />;
    case 'stats':
      return (
        <dl className="review-stats">
          {block.items.map((item) => (
            <div key={item.label} className="review-stat">
              <dd className="review-stat-value">{item.value}</dd>
              <dt className="review-stat-label">{item.label}</dt>
            </div>
          ))}
        </dl>
      );
    case 'section':
      return (
        <div className="review-section">
          <h3 className="review-section-title">{block.title}</h3>
          <span className="review-section-rule" />
        </div>
      );
    case 'divider':
      return <hr className="review-perforation" />;
    case 'groups':
      return (
        <div className="review-groups">
          {block.groups.map((group, index) => (
            <Group key={index} group={group} />
          ))}
        </div>
      );
    case 'roster':
      return (
        <div className="review-roster" data-columns={block.columns}>
          {block.rows.map((row) => (
            <RosterRow key={row.seat} row={row} />
          ))}
        </div>
      );
    case 'facts':
      return (
        <dl className="review-facts">
          {block.items.map((item) => (
            <div key={item.label} className="review-fact">
              <dt className="review-fact-label">{item.label}</dt>
              <dd className="review-fact-value">{item.value}</dd>
            </div>
          ))}
        </dl>
      );
    case 'timeline':
      return (
        <ol className="review-timeline">
          {block.steps.map((step, index) => (
            <TimelineStep key={index} step={step} />
          ))}
        </ol>
      );
    case 'scoreboard':
      return (
        <div className="review-scoreboard">
          {block.rows.map((row) => (
            <div key={row.seat} className="review-score-row">
              <span
                className="review-rank"
                data-tone={row.rank <= PODIUM_RANK_LIMIT ? 'highlight' : 'neutral'}
              >
                {row.rank}
              </span>
              <SeatMedal seat={row.seat} size="inline" tone="neutral" isStamped={false} />
              <span className="review-score-name">{row.name}</span>
              {row.tag !== null && <ReviewTag text={row.tag.text} tone={row.tag.tone} />}
              <span className="review-score-value">{row.scoreText}</span>
            </div>
          ))}
        </div>
      );
    case 'paragraph':
      return (
        <div className="review-captioned">
          {block.caption !== null && <p className="review-caption">{block.caption}</p>}
          <p className="review-paragraph" data-missing={block.isMissing}>
            {block.text}
          </p>
        </div>
      );
    case 'image':
      return <ReviewImageBlock block={block} blockId={blockId} />;
  }
}
