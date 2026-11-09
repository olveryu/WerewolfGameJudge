/**
 * 结算提示：全员猜中导致画手本轮收入清零时，结算榜上方的一行说明。
 */

import { TESTIDS } from '@/testids';

import {
  DRAWGUESS_DRAWER_ZEROED_DETAIL,
  DRAWGUESS_DRAWER_ZEROED_TITLE,
} from '../../model/drawGuessResults';

/** 结算榜上方的清零说明整句。 */
export const DRAWGUESS_DRAWER_ZEROED_NOTE = `${DRAWGUESS_DRAWER_ZEROED_TITLE}：${DRAWGUESS_DRAWER_ZEROED_DETAIL}`;

/** Renders the zeroed-drawer note only when the drawer's round gain was zeroed. */
export function DrawGuessDrawerZeroedNote({ visible }: { readonly visible: boolean }) {
  if (!visible) return null;
  return (
    <p className="drawguess-hint" data-testid={TESTIDS.drawGuessDrawerZeroedNote}>
      {DRAWGUESS_DRAWER_ZEROED_NOTE}
    </p>
  );
}
