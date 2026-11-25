import type {
  WerewolfPersonalDaytimeViewDeclaration,
  WerewolfRoleCard,
  WerewolfRoleDefinition,
} from './role';
import { defineRole } from './role';

type PassiveRoleTraits = WerewolfRoleDefinition['traits'];

type PassiveDeathEffect = NonNullable<WerewolfRoleDefinition['passiveDeathEffects']>;

export function createPassiveRole<const TId extends string>(
  id: TId,
  card: WerewolfRoleCard,
  traits: PassiveRoleTraits,
  passiveDeathEffects?: PassiveDeathEffect,
  personalDaytimeView?: WerewolfPersonalDaytimeViewDeclaration,
): WerewolfRoleDefinition<TId> {
  const definition = {
    id,
    card,
    traits,
    steps: [],
    ...(passiveDeathEffects === undefined ? {} : { passiveDeathEffects }),
    ...(personalDaytimeView === undefined ? {} : { personalDaytimeView }),
  } satisfies WerewolfRoleDefinition<TId>;
  return defineRole(definition);
}
