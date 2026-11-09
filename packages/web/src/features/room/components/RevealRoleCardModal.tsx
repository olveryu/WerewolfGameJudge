/**
 * Shared identity-card modal every identity-viewing game renders. Games supply their role key
 * and their adapter from that key to RevealRoleData. The first-view reveal animation (scene
 * layer, P3) wraps this card; until then the card opens statically.
 */
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

import { RoleCardDialog } from './RoleCard';

export function RevealRoleCardModal<TKey>({
  visible,
  roleKey,
  toRoleData,
  onClose,
}: {
  readonly visible: boolean;
  readonly roleKey: TKey | null;
  /** The game's adapter from its role key to the shared reveal data. */
  readonly toRoleData: (key: TKey) => RevealRoleData;
  readonly onClose: () => void;
}) {
  if (!visible || roleKey === null) return null;
  return <RoleCardDialog role={toRoleData(roleKey)} onClose={onClose} />;
}
