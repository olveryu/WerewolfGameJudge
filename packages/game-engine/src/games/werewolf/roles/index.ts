import { cupidPresence } from './cupid';
import { drunkSeerPresence } from './drunkSeer';
import { mirrorSeerPresence } from './mirrorSeer';
import { poisonerPresence } from './poisoner';
import type { PresenceDeclaration } from './presence';
import { seerPresence } from './seer';
import { thiefPresence } from './thief';
import { treasureMasterPresence } from './treasureMaster';

export { createWerewolfRoleContext, type WerewolfRoleContext } from './context';
export {
  type AttackCause,
  type DeathCause,
  type DeathEffect,
  type DeathResolution,
  type DeathTraceEntry,
  resolveDeathEffects,
} from './deathEffects';
export {
  getActiveRoleIds,
  getSeatIdentity,
  grantBorrowedAbility,
  type IdentityLayer,
  replaceCurrentRole,
  type SeatIdentity,
} from './identity';
export {
  type LocationLayer,
  resolveSelectedSeat,
  resolveSelectedSeats,
  resolveTargetSelection,
  type SeatSwap,
  type TargetSelection,
} from './location';
export {
  type NightPresenceFacts,
  type PresenceDeclaration,
  type PresenceEffect,
  resolveNightPresenceFacts,
} from './presence';
export { getSeenRole, type SightLayer } from './sight';

export const WEREWOLF_PRESENCE_DECLARATIONS = [
  ...poisonerPresence,
  ...cupidPresence,
  ...thiefPresence,
  ...treasureMasterPresence,
  ...seerPresence,
  ...mirrorSeerPresence,
  ...drunkSeerPresence,
] as const satisfies readonly PresenceDeclaration<string>[];
