export interface SeatIdentity<TRole extends string> {
  readonly dealtRole: TRole;
  readonly currentRole: TRole;
  readonly borrowedAbilityRole: TRole | null;
}

export type IdentityLayer<TRole extends string> = Readonly<Record<string, SeatIdentity<TRole>>>;

export function getSeatIdentity<TRole extends string>(
  identities: IdentityLayer<TRole>,
  seat: number,
): SeatIdentity<TRole> {
  const identity = identities[seat];
  if (identity === undefined) {
    throw new Error(`[FAIL-FAST] Missing identity for seat ${seat}`);
  }
  return identity;
}

export function replaceCurrentRole<TRole extends string>(
  identities: IdentityLayer<TRole>,
  seat: number,
  currentRole: TRole,
): IdentityLayer<TRole> {
  const identity = getSeatIdentity(identities, seat);
  return {
    ...identities,
    [seat]: { ...identity, currentRole, borrowedAbilityRole: null },
  };
}

export function grantBorrowedAbility<TRole extends string>(
  identities: IdentityLayer<TRole>,
  seat: number,
  borrowedAbilityRole: TRole,
): IdentityLayer<TRole> {
  const identity = getSeatIdentity(identities, seat);
  return { ...identities, [seat]: { ...identity, borrowedAbilityRole } };
}

export function getActiveRoleIds<TRole extends string>(
  identity: SeatIdentity<TRole>,
): readonly TRole[] {
  if (
    identity.borrowedAbilityRole === null ||
    identity.borrowedAbilityRole === identity.currentRole
  ) {
    return [identity.currentRole];
  }
  return [identity.currentRole, identity.borrowedAbilityRole];
}
