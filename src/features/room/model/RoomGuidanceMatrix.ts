/**
 * Room guidance matrix: the declared contract for bottom-panel guidance.
 *
 * Every game declares, for each of its phases and each viewer kind,
 * whether the bottom panel shows a guidance message in the phase's
 * entry state, or why it legitimately does not (the guidance lives on
 * another surface: the primary action button, the step progress row,
 * the seat board, the host console, the stage workspace …). A cell is
 * never allowed to be silently blank — it either promises a message or
 * registers the exemption reason, and each game's matrix test drives
 * its real adapter/engine flow per cell to hold the declaration true.
 *
 * Cell semantics: the phase's entry state for that viewer (the moment
 * the phase begins, before the viewer acts). A sentence that only
 * appears after the viewer acts (a post-vote count line, a post-view
 * wait) does not make the cell a message cell; it is named in the
 * exemption reason instead.
 */

export type RoomGuidanceViewer = 'host' | 'seated' | 'spectator';

export type RoomGuidanceCell =
  | { readonly kind: 'message' }
  | { readonly kind: 'exempt'; readonly reason: string };

export type RoomGuidanceMatrix<Phase extends string> = Readonly<
  Record<Phase, Readonly<Record<RoomGuidanceViewer, RoomGuidanceCell>>>
>;

export const GUIDANCE_MESSAGE: RoomGuidanceCell = { kind: 'message' };

export function guidanceExempt(reason: string): RoomGuidanceCell {
  return { kind: 'exempt', reason };
}
