/**
 * Conversion — the part of the night shared by every role that can turn
 * another player into a different role. The converting role declares the
 * rule (`WerewolfConversionDeclaration`); this module only applies it.
 */

import type {
  WerewolfConversionDeclaration,
  WerewolfRoleStepContext,
  WerewolfRoleStepDefinition,
} from './role';

type Conversion = NonNullable<WerewolfRoleStepContext['facts']['conversions']>[number];

/** Keep a converted player in their former role's later steps, with every skill locked. */
export function withConversionLock(
  step: WerewolfRoleStepDefinition,
  ownerRoleId: string,
  declarationOf: (roleId: string) => WerewolfConversionDeclaration,
): WerewolfRoleStepDefinition {
  if (step.audience === 'allSeats') return step;
  const getConversions = (context: WerewolfRoleStepContext): readonly Conversion[] =>
    (context.facts.conversions ?? []).filter((conversion) =>
      conversion.formerRoleIds.includes(ownerRoleId),
    );
  const getOwnConversion = (context: WerewolfRoleStepContext): Conversion | undefined =>
    getConversions(context).find((conversion) => conversion.seat === context.seat);
  return {
    ...step,
    actors: (context) => {
      const actors = step.actors(context);
      const converted = getConversions(context)
        .map((conversion) => conversion.seat)
        .filter((seat) => !actors.includes(seat));
      return converted.length === 0
        ? actors
        : [...actors, ...converted].sort((first, second) => first - second);
    },
    lock: (context) => {
      const conversion = getOwnConversion(context);
      return conversion === undefined
        ? (step.lock?.(context) ?? null)
        : declarationOf(conversion.byRoleId).convertedLock.reason;
    },
    situationHints: (context) => {
      const conversion = getOwnConversion(context);
      return conversion === undefined
        ? (step.situationHints?.(context) ?? [])
        : [declarationOf(conversion.byRoleId).convertedLock.hint];
    },
  };
}
