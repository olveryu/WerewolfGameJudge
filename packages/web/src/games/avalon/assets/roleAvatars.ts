/** Avalon role-card image registry: the compressed 512px WebP portraits. */
import {
  AVALON_BOARDS,
  type AvalonRoleId,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';

import assassin from '../../../../../../assets/avatars/web/assassin.webp';
import loyal from '../../../../../../assets/avatars/web/loyal.webp';
import merlin from '../../../../../../assets/avatars/web/merlin.webp';
import minion from '../../../../../../assets/avatars/web/minion.webp';
import mordred from '../../../../../../assets/avatars/web/mordred.webp';
import morgana from '../../../../../../assets/avatars/web/morgana.webp';
import oberon from '../../../../../../assets/avatars/web/oberon.webp';
import percival from '../../../../../../assets/avatars/web/percival.webp';

const AVALON_ROLE_IMAGE_MAP: Readonly<Record<AvalonRoleId, string>> = {
  merlin,
  percival,
  assassin,
  morgana,
  oberon,
  mordred,
  loyalServant: loyal,
  minion,
};

/** Resolve Avalon role IDs to the game's hand-drawn role-card asset URLs. */
export function getRoleAvatar(roleId: AvalonRoleId): string {
  return AVALON_ROLE_IMAGE_MAP[roleId];
}

/** Portrait candidates come from the public player-count board, never the dealt identities. */
export function getBoardRolePortraits(playerCount: number): readonly string[] {
  if (!isAvalonPlayerCount(playerCount)) {
    throw new Error(`[FAIL-FAST] Invalid Avalon player count: ${playerCount}`);
  }
  return [...new Set(AVALON_BOARDS[playerCount])].map(getRoleAvatar);
}
