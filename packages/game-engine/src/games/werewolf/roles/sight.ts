import { getSeatIdentity, type IdentityLayer } from './identity';

export interface SightLayer<TRole extends string> {
  readonly roleOverridesBySeat: Readonly<Record<string, TRole>>;
}

export function getSeenRole<TRole extends string>(
  identities: IdentityLayer<TRole>,
  sight: SightLayer<TRole>,
  actualSeat: number,
): TRole {
  return (
    sight.roleOverridesBySeat[actualSeat] ?? getSeatIdentity(identities, actualSeat).currentRole
  );
}
