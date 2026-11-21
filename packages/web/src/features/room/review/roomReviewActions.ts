/**
 * The review entry as room actions. Every game renders the same entry —
 * key, label, icon, test ids — through these builders; only the placement
 * (which bottom tier, which host section) stays the game's decision.
 */

import { TESTIDS } from '@/testids';

import { HOST_ACTION_KEYS } from '../model/hostManagementActions';
import type { RoomHostAction, RoomPlayerAction } from '../model/RoomAction';
import type { RoomViewer } from '../model/RoomViewer';
import { REVIEW_TITLE } from './reviewCopy';

const REVIEW_ICON = 'document-text-outline';

/**
 * The review entry for one viewer, in the shape of a room action's
 * availability: enabled with its press, or disabled with the reason the
 * viewer may not read it.
 */
export type RoomReviewEntry = { readonly isPending?: boolean } & (
  | { readonly isEnabled: true; readonly onPress: () => void }
  | { readonly isEnabled: false; readonly disabledReason: string }
);

/** The review as a bottom button. A review is public to its readers, so the audience is `anyone`. */
export function buildReviewBottomButton(entry: RoomReviewEntry): RoomPlayerAction {
  return {
    key: HOST_ACTION_KEYS.review,
    label: REVIEW_TITLE,
    audience: 'anyone',
    icon: REVIEW_ICON,
    category: 'resource',
    testID: TESTIDS.roomReviewOpenButton,
    opensDialog: true,
    state: entry.isEnabled
      ? { kind: 'ready', onPress: entry.onPress }
      : { kind: 'blocked', reason: entry.disabledReason },
    ...(entry.isPending === undefined ? {} : { isPending: entry.isPending }),
  };
}

/**
 * The review on the bottom panel for seats and spectators. The host reaches
 * the review through the host task card, and the bottom panel carries no
 * host flow, so the host gets no bottom review button.
 */
export function buildViewerReviewBottomButtons(
  entry: RoomReviewEntry,
  viewer: Pick<RoomViewer, 'isHost'>,
): readonly RoomPlayerAction[] {
  return viewer.isHost ? [] : [buildReviewBottomButton(entry)];
}

/** The review as a host sheet action, referenced by host tasks through `HOST_ACTION_KEYS.review`. */
export function buildReviewHostAction(entry: RoomReviewEntry): RoomHostAction {
  return {
    key: HOST_ACTION_KEYS.review,
    label: REVIEW_TITLE,
    icon: REVIEW_ICON,
    category: 'resource',
    testID: TESTIDS.roomReviewHostAction,
    opensDialog: true,
    state: entry.isEnabled
      ? { kind: 'ready', onPress: entry.onPress }
      : { kind: 'blocked', reason: entry.disabledReason },
  };
}
