import { getSeatIdentity, type IdentityLayer } from './identity';
import { type LocationLayer, resolveSelectedSeat } from './location';
import { getSeenRole, type SightLayer } from './sight';

export interface WerewolfRoleContext<TRole extends string> {
  readonly roleOf: (seat: number) => TRole;
  readonly landing: (chosenSeat: number) => number;
  readonly seenRole: (seat: number) => TRole;
}

export function createWerewolfRoleContext<TRole extends string>(
  identities: IdentityLayer<TRole>,
  location: LocationLayer,
  sight: SightLayer<TRole>,
): WerewolfRoleContext<TRole> {
  return {
    roleOf: (seat) => getSeatIdentity(identities, seat).currentRole,
    landing: (chosenSeat) => resolveSelectedSeat(chosenSeat, location),
    seenRole: (seat) => getSeenRole(identities, sight, seat),
  };
}
