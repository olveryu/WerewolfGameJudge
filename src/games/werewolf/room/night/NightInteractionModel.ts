/**
 * NightInteractionModel — what the viewer can do in the current night
 * step, as pure data: UI = f(viewModel, draft).
 *
 * One variant per interaction shape the night schemas declare. The
 * seat board, the bottom bar and the night dialog all render from the
 * same model; nothing re-derives a rule from state (the engine's
 * WerewolfViewModel already cropped every fact to the viewer). Local
 * draft state (a first swap seat, a multi-select set, a pending pick)
 * is the only client-owned input and is folded in here.
 */

import type {
  BottomCardChoice,
  ConfirmStatus,
  SchemaId,
  WerewolfPendingReveal,
  WerewolfRevealView,
} from '@game-judge/game-engine/games/werewolf/public';

/** Title + body of the step's dialog, rendered from the schema templates. */
export interface NightPrompt {
  readonly title: string;
  readonly text: string;
}

/** Text of the groupConfirm dialog, personalized to the viewer. */
export interface GroupRevealText {
  readonly title: string;
  readonly text: string;
  readonly confirmLabel: string;
}

/** The viewer's seat picks in the current step, persisted per step scope. */
export interface NightDraft {
  /** swap: the first chosen seat. */
  readonly firstSwapSeat: number | null;
  /** multiChooseSeat: the chosen set, in pick order. */
  readonly multiSelectedSeats: readonly number[];
}

/** The two-seat swap pick; `second` is set in the same render the confirm opens. */
export interface SwapPick {
  readonly first: number | null;
  readonly second: number | null;
}

export type NightInteractionModel =
  /** Not the actioner, or not in the night flow. */
  | { readonly kind: 'idle' }
  /** Narration is playing, or the previous step's ack has not landed. */
  | { readonly kind: 'blocked'; readonly reason: string }
  /** chooseSeat: pick one seat and confirm; reveal flows add an ack afterwards. */
  | {
      readonly kind: 'pickSeat';
      readonly stepId: SchemaId;
      readonly selectable: readonly number[];
      readonly prompt: NightPrompt;
      readonly confirmTitle: string;
      readonly confirmText: string;
      readonly skipLabel: string | null;
    }
  /** wolfVote: every wolf picks; votes are changeable until the countdown settles. */
  | {
      readonly kind: 'wolfVote';
      readonly selectable: readonly number[];
      readonly myVote: number | null;
      readonly votes: Readonly<Record<string, number>>;
      readonly deadlineAt: number | null;
      readonly prompt: NightPrompt;
      readonly confirmTitle: string;
      /** Confirm body for a seat vote; `{seat}` is the picked seat. */
      readonly voteConfirmTemplate: string;
      readonly emptyVoteConfirmText: string;
      readonly emptyVoteLabel: string;
      /** The hint restricts the wolves to an empty vote (a kill-disabled night). */
      readonly emptyVoteOnly: boolean;
      /** Seats whose role is immune to the wolf kill (the confirm notes it). */
      readonly immuneSeats: readonly number[];
      /** The summary line: voted/total wolves, countdown or change hint. */
      readonly statusLine: string;
    }
  /** swap: two seats; the second opens the confirm. */
  | {
      readonly kind: 'pickTwoSeats';
      readonly selectable: readonly number[];
      readonly pick: SwapPick;
      readonly prompt: NightPrompt;
      readonly firstPickTitle: string;
      /** Body after the first pick; `{seat}` is the first seat. */
      readonly firstPickTemplate: string;
      readonly confirmTitle: string;
      readonly confirmText: string;
      readonly skipLabel: string | null;
    }
  /** multiChooseSeat: toggle up to `max`, confirm the set. */
  | {
      readonly kind: 'multiSelect';
      readonly selectable: readonly number[];
      readonly selected: readonly number[];
      readonly max: number;
      readonly prompt: NightPrompt;
      /** Confirm dialog title; the body lists the picked seats. */
      readonly confirmText: string;
      /** Confirm button label; `{count}` is the picked count. */
      readonly confirmButtonTemplate: string;
      readonly skipLabel: string | null;
    }
  /** compound (witch): save by button, poison by seat pick, or neither. */
  | {
      readonly kind: 'witch';
      readonly killedSeat: number | null;
      readonly canSave: boolean;
      readonly canPoison: boolean;
      readonly selectable: readonly number[];
      readonly prompt: NightPrompt;
      readonly saveLabel: string;
      readonly saveConfirmTitle: string;
      readonly saveConfirmText: string;
      readonly poisonConfirmTitle: string;
      readonly poisonConfirmText: string;
      readonly skipLabel: string;
    }
  /** confirm: a status to acknowledge (shoot / faction / teammates / infection). */
  | {
      readonly kind: 'confirmStatus';
      readonly status: ConfirmStatus;
      readonly prompt: NightPrompt;
      readonly dialog: NightPrompt;
      readonly buttonLabel: string;
      /** Seed wolf only: the skip alternative when infection is available. */
      readonly skipLabel: string | null;
      /** The status cannot be acted on (seed wolf without a target): acknowledge only. */
      readonly isUnavailable: boolean;
    }
  /** chooseCard: pick a bottom card; legality comes from the engine. */
  | {
      readonly kind: 'chooseCard';
      readonly choice: BottomCardChoice;
      readonly prompt: NightPrompt;
      readonly confirmText: string;
      readonly openLabel: string;
    }
  /** groupConfirm: everyone acknowledges a personalized reveal. */
  | {
      readonly kind: 'ackGroupReveal';
      readonly reveal: WerewolfRevealView;
      readonly prompt: NightPrompt;
      readonly text: GroupRevealText;
      readonly openLabel: string;
      readonly hasAcked: boolean;
    }
  /** A check result the viewer still owes an ack for (re-entered after reload). */
  | { readonly kind: 'ackReveal'; readonly reveal: WerewolfPendingReveal; readonly title: string }
  /** Wolf robot learned hunter: acknowledge the shoot status before the night continues. */
  | {
      readonly kind: 'ackHunterStatus';
      readonly canShoot: boolean;
      readonly prompt: NightPrompt;
      readonly dialog: NightPrompt;
      readonly buttonLabel: string;
    }
  /** skip-only step (a hint restricted the actioner to skipping, or the schema is skip). */
  | { readonly kind: 'skipOnly'; readonly prompt: NightPrompt; readonly skipLabel: string };

export type NightInteractionKind = NightInteractionModel['kind'];
