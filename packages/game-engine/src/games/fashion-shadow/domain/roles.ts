// Deterministic seven-role assignment for Fashion Shadow.

import { createSeededRng, shuffleArray } from '../../../platform/random';
import { FASHION_ROLE_IDS, type FashionRoleId, type FashionSecretId } from '../state/types';
import { FASHION_ROLE_BY_ID } from './content';

export interface FashionAssignments {
  readonly roles: Readonly<Record<number, FashionRoleId>>;
  readonly secrets: Readonly<Record<number, FashionSecretId>>;
}

export function assignFashionRoles(randomSeed: string): FashionAssignments {
  if (randomSeed.length === 0) {
    throw new Error('Fashion role assignment requires a non-empty random seed');
  }
  const shuffledRoles = shuffleArray(
    [...FASHION_ROLE_IDS],
    createSeededRng(`${randomSeed}:fashion-shadow:roles`),
  );
  const roles: Record<number, FashionRoleId> = {};
  const secrets: Record<number, FashionSecretId> = {};
  shuffledRoles.forEach((roleId, seat) => {
    roles[seat] = roleId;
    secrets[seat] = FASHION_ROLE_BY_ID[roleId].secretId;
  });
  return { roles, secrets };
}
