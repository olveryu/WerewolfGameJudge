/**
 * The review entry as room actions. Every game renders the same entry —
 * key, label, icon, test ids — through these builders; only the placement
 * (which bottom tier, which host section) stays the game's decision.
 */

import { TESTIDS } from '@/testids';

import { HOST_ACTION_KEYS } from '../model/hostManagementActions';
import type { RoomBottomButton } from '../model/RoomBottomActions';
import type { RoomHostManagementAction } from '../model/RoomHostManagement';
import type { RoomViewer } from '../model/RoomViewer';
import { REVIEW_TITLE } from './reviewCopy';

const REVIEW_ICON = 'document-text-outline';

/**
 * The review entry for one viewer, in the shape of a room action's
 * availability: enabled with its press, or disabled with the reason the
 * viewer may not read it.
 */
export type RoomReviewEntry =
  | { readonly isEnabled: true; readonly onPress: () => void }
  | { readonly isEnabled: false; readonly disabledReason: string };

/** The review as a bottom button. A review is public to its readers, so the audience is `anyone`. */
export function buildReviewBottomButton(
  entry: RoomReviewEntry,
  variant: RoomBottomButton['variant'],
): RoomBottomButton {
  return {
    key: HOST_ACTION_KEYS.review,
    label: REVIEW_TITLE,
    audience: 'anyone',
    icon: REVIEW_ICON,
    variant,
    size: 'md',
    testID: TESTIDS.roomReviewOpenButton,
    ...entry,
  };
}

/**
 * The review on the bottom panel for seats and spectators. The host reaches
 * the review through the host task card, and the bottom panel carries no
 * host flow, so the host gets no bottom review button.
 */
export function buildViewerReviewBottomButtons(
  entry: RoomReviewEntry,
  variant: RoomBottomButton['variant'],
  viewer: Pick<RoomViewer, 'isHost'>,
): readonly RoomBottomButton[] {
  return viewer.isHost ? [] : [buildReviewBottomButton(entry, variant)];
}

/** The review as a host sheet action, referenced by host tasks through `HOST_ACTION_KEYS.review`. */
export function buildReviewHostAction(entry: RoomReviewEntry): RoomHostManagementAction {
  return {
    key: HOST_ACTION_KEYS.review,
    label: REVIEW_TITLE,
    icon: REVIEW_ICON,
    variant: 'secondary',
    testID: TESTIDS.roomReviewHostAction,
    ...entry,
  };
}
