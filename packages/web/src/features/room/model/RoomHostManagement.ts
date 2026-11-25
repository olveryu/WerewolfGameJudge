/**
 * Render-ready host management model. Games own action availability and execution.
 *
 * Two parts (docs/room-shell-contract.md "Host Task"): `actions` is the
 * complete command inventory — every host command's onPress lives there and
 * only there; `task` is the one declared "what the host does now", which
 * references sheet actions by key and never carries a handler of its own.
 */

import type { RoomHostAction } from './RoomAction';

/** One step of a multi-step host flow rendered on the task card. */
export interface RoomHostTaskStep {
  readonly key: string;
  readonly label: string;
  readonly state: 'complete' | 'current' | 'upcoming';
  /** A completed step may be revisited through this sheet action. */
  readonly actionKey?: string;
}

interface RoomHostTaskBase {
  /** Multi-step flow progress; omitted for a single step. At most one `current`. */
  readonly steps?: readonly RoomHostTaskStep[];
  /** Reminder rendered under the task. */
  readonly note?: string;
}

/**
 * The host's one current task. It has no handler: every key resolves to a
 * sheet action whose onPress, enabled state and disabled reason the card
 * renders — one command, one execution path.
 */
export type RoomHostTask = RoomHostTaskBase &
  (
    | { readonly kind: 'action'; readonly actionKey: string }
    | { readonly kind: 'choice'; readonly actionKeys: readonly string[] }
    | { readonly kind: 'message'; readonly text: string; readonly escapeActionKey?: string }
  );

export interface RoomHostManagementModel {
  /** The one thing the host should do now; null when nothing awaits the host. */
  readonly task: RoomHostTask | null;
  /** Game-declared outstanding actions, including blocked actions. */
  readonly pendingActionKeys?: readonly string[];
  /** A required decision with alternative remedies, rather than a single required action. */
  readonly hasPendingDecision?: boolean;
  /** The complete host action inventory. */
  readonly actions: readonly RoomHostAction[];
  /** One host action can open a sub-hand of other inventory actions. */
  readonly group?: {
    readonly actionKey: string;
    readonly actionKeys: readonly string[];
  };
}

/** Label for the persistent host-management entry. Referenced by hints; do not hardcode. */
export const HOST_MANAGEMENT_LABEL = '主持管理';
