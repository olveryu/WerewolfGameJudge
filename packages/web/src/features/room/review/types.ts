/**
 * Cross-game review （本局复盘） contract: a game turns its state into a
 * declarative document; the platform renders that one document in the
 * room and as the shared image, and owns the whole export flow.
 *
 * Games own facts and copy — every Chinese string inside a document comes
 * from the game, except the generated-by footer most games share. The
 * platform owns the review's name and share title (`reviewCopy.ts`),
 * layout, colors and flow. The block
 * vocabulary is closed: the renderer switches over `ReviewBlock['kind']`
 * exhaustively, and a game that needs a new expression extends the
 * vocabulary here first (docs/game-review-share-design.md §3, §4).
 */

import type { RoomViewer } from '../model/RoomViewer';

/**
 * Semantic tones. Games map their own vocabulary onto them (a werewolf is
 * `evil`, a blank card `special`); only the platform turns a tone into a
 * color, so no game word ever reaches the shared layer.
 */
export type ReviewTone = 'neutral' | 'good' | 'evil' | 'special' | 'out' | 'highlight' | 'muted';

/**
 * One inline element of a line. Consecutive `text` inlines flow as one
 * sentence (a toned word stays inside the sentence); a `seat` medal or a
 * `tag` sits between text runs as its own element.
 */
export type ReviewInline =
  | { readonly kind: 'text'; readonly text: string; readonly tone: ReviewTone }
  | { readonly kind: 'seat'; readonly seat: number; readonly tone: ReviewTone }
  | { readonly kind: 'tag'; readonly text: string; readonly tone: ReviewTone };

/** One run of a hero headline: words, or a display-size figure （昨夜 <2> 人出局）. */
export type ReviewHeadlineRun =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'figure'; readonly text: string; readonly tone: ReviewTone };

/** A seat stamped under the hero: medal, title line, caption, optional note. */
export interface ReviewStamp {
  readonly seat: number;
  readonly tone: ReviewTone;
  readonly title: string;
  readonly caption: string;
  readonly note: string | null;
}

export interface ReviewLabeledValue {
  readonly label: string;
  readonly value: string;
}

export interface ReviewGroupRow {
  readonly cells: readonly ReviewInline[];
  readonly isDimmed: boolean;
}

export interface ReviewGroup {
  readonly title: string;
  readonly railTone: ReviewTone;
  readonly tag: { readonly text: string; readonly tone: ReviewTone } | null;
  readonly rows: readonly ReviewGroupRow[];
  readonly footnote: string | null;
}

export interface ReviewRosterRow {
  readonly seat: number;
  readonly seatTone: ReviewTone;
  /** The player's display name; null where the game identifies seats by role only. */
  readonly name: string | null;
  readonly role: string;
  readonly status: string;
  readonly statusTone: ReviewTone;
  /** An eliminated seat: the role is struck through and the status emphasized. */
  readonly isOut: boolean;
}

/** One step on a timeline rail: an optional title, then lines of inline content. */
export interface ReviewTimelineStep {
  readonly title: string | null;
  readonly tone: ReviewTone;
  readonly lines: readonly (readonly ReviewInline[])[];
}

/** One ranked row. The game decides the rank (ties share a rank) and formats the score. */
export interface ReviewScoreRow {
  readonly rank: number;
  readonly seat: number;
  readonly name: string;
  readonly scoreText: string;
  readonly tag: { readonly text: string; readonly tone: ReviewTone } | null;
}

/**
 * The result of loading one image. `unavailable` is a final, honest state
 * (the media expired) that renders the game's message and never blocks an
 * export; a rejected load is a failure the reader can retry.
 */
export type ReviewImageLoadResult =
  | { readonly kind: 'loaded'; readonly dataUri: string }
  | { readonly kind: 'unavailable'; readonly message: string };

export type ReviewBlock =
  /** Conclusion: headline, stamped seats, byline. */
  | {
      readonly kind: 'hero';
      readonly headline: readonly ReviewHeadlineRun[];
      readonly tone: ReviewTone;
      readonly stamps: readonly ReviewStamp[];
      readonly byline: string | null;
    }
  /** A strip of headline numbers: 成功 3 · 失败 2 · 否决 1. */
  | { readonly kind: 'stats'; readonly items: readonly ReviewLabeledValue[] }
  /** A section title with a rule. */
  | { readonly kind: 'section'; readonly title: string }
  /** A perforation between the report body and its appendix. */
  | { readonly kind: 'divider' }
  /** Railed groups of rows: one quest, one actor, one proposal list. */
  | { readonly kind: 'groups'; readonly groups: readonly ReviewGroup[] }
  /** The identity wall. */
  | { readonly kind: 'roster'; readonly columns: 1 | 2; readonly rows: readonly ReviewRosterRow[] }
  /** Key-value facts: 平民词 / 卧底词 / 投票方式. */
  | { readonly kind: 'facts'; readonly items: readonly ReviewLabeledValue[] }
  /** Ordered steps behind a dotted rail: night actions, elimination order, picks. */
  | { readonly kind: 'timeline'; readonly steps: readonly ReviewTimelineStep[] }
  /** A ranking. */
  | { readonly kind: 'scoreboard'; readonly rows: readonly ReviewScoreRow[] }
  /**
   * Body text, optionally labelled （第 2 棒 · 小明）; `isMissing` marks the game's
   * placeholder for an absent contribution.
   */
  | {
      readonly kind: 'paragraph';
      readonly caption: string | null;
      readonly text: string;
      readonly isMissing: boolean;
    }
  /**
   * A drawing labelled by its caption. The platform loads it, shows
   * loading/failure/retry and gates the export on it.
   */
  | {
      readonly kind: 'image';
      readonly assetId: string;
      readonly caption: string;
      readonly aspectRatio: number;
      readonly load: (signal: AbortSignal) => Promise<ReviewImageLoadResult>;
    };

export type ReviewImageBlock = Extract<ReviewBlock, { readonly kind: 'image' }>;

export interface RoomReviewPage {
  readonly key: string;
  /** Page label when the document has several pages （第 1 篇 · 小明的画册）; null on a single page. */
  readonly label: string | null;
  readonly blocks: readonly ReviewBlock[];
}

export interface RoomReviewDocument {
  /** The game round this document reviews; part of the export cache scope. */
  readonly roundKey: string;
  /** Masthead kicker on every surface （🌙 第一夜 · 夜报）. */
  readonly kicker: string;
  /** Image file name stem `${gameType}-${roomCode}-${roundTag}`; pages append `-p<n>`. */
  readonly fileStem: string;
  /** The line under the last block: `REVIEW_GENERATED_FOOTER`, or the game's own notice. */
  readonly footer: string;
  /** An aborted round: the masthead carries the 未完成 stamp. */
  readonly isAborted: boolean;
  readonly pages: readonly RoomReviewPage[];
}

/** Whether this viewer may export the document they can read. */
export type RoomReviewSharing =
  | { readonly isAllowed: true }
  | { readonly isAllowed: false; readonly reason: string };

/** A confirmation shown before the dialog opens （a mid-game review warns about spoilers）. */
export interface RoomReviewConfirmation {
  readonly title: string;
  readonly message: string;
  readonly confirmText: string;
}

export type RoomReviewAvailability =
  /** Nothing to review yet: no entry renders. */
  | { readonly kind: 'notEnded' }
  /** A review exists but this viewer may not read it: the entry renders disabled with the reason. */
  | { readonly kind: 'notPermitted'; readonly reason: string }
  | {
      readonly kind: 'available';
      readonly document: RoomReviewDocument;
      readonly sharing: RoomReviewSharing;
      readonly confirmation: RoomReviewConfirmation | null;
    };

export interface RoomReviewInput<TState> {
  readonly state: TState;
  readonly viewer: RoomViewer;
  readonly roomCode: string;
}

/**
 * A game's review contribution, declared once in its client module.
 * `resolve` is pure: the same input yields a structurally equal result.
 * A finished round missing a fact it must have is a construction error and
 * throws instead of rendering a placeholder.
 */
export interface RoomReviewContribution<TState> {
  readonly resolve: (input: RoomReviewInput<TState>) => RoomReviewAvailability;
}
