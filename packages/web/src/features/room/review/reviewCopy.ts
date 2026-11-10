/**
 * The review copy the platform owns. Every game's review shares one name,
 * one share title and one generated-by footer, so no game restates them.
 */

/** The review's name on every surface: its room entry, its host action and its dialog title. */
export const REVIEW_TITLE = '本局复盘';

/**
 * The footer of a review generated from the room's record. A game whose
 * review carries a notice of its own declares that footer instead.
 */
export const REVIEW_GENERATED_FOOTER = '本局复盘由对局记录自动生成';

/** The masthead title of an exported page, and the title the share sheet receives. */
export function formatReviewShareTitle(roomCode: string): string {
  return `房间 ${roomCode} 战报`;
}
