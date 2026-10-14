/**
 * roleAvatars — Avalon role-card image registry (native: PNG)
 *
 * Native platforms use full-size raw PNGs.
 * See roleAvatars.web.ts for the web variant (512px WebP).
 */

import type { AvalonRoleId } from '@game-judge/game-engine/games/avalon/public';

import assassin from '../../../../assets/avatars/raw/assassin.png';
import loyal from '../../../../assets/avatars/raw/loyal.png';
import merlin from '../../../../assets/avatars/raw/merlin.png';
import minion from '../../../../assets/avatars/raw/minion.png';
import mordred from '../../../../assets/avatars/raw/mordred.png';
import morgana from '../../../../assets/avatars/raw/morgana.png';
import oberon from '../../../../assets/avatars/raw/oberon.png';
import percival from '../../../../assets/avatars/raw/percival.png';

const AVALON_ROLE_IMAGE_MAP: Record<AvalonRoleId, number> = {
  merlin,
  percival,
  assassin,
  morgana,
  oberon,
  mordred,
  loyalServant: loyal,
  minion,
};

/** Resolve Avalon role IDs to the game's hand-drawn role-card assets. */
export function getRoleAvatar(roleId: AvalonRoleId): number {
  return AVALON_ROLE_IMAGE_MAP[roleId];
}
