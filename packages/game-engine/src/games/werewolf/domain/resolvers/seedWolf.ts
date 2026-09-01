/**
 * Seed Wolf resolvers.
 *
 * The infection target is fixed by the authoritative wolf-vote context. This
 * module only records whether Seed Wolf chose to infect; final success is
 * decided after all other night actions.
 */

import type { ResolverFn } from './types';

export const seedWolfInfectResolver: ResolverFn = (context, input) => {
  if (input.confirmed !== true) {
    return { valid: true };
  }

  const infectionContext = context.gameState.seedWolfInfectionContext;
  if (!infectionContext || infectionContext.availability === 'unavailable') {
    return { valid: false, rejectReason: '本夜没有可感染的狼人袭击目标' };
  }

  return {
    valid: true,
    updates: { seedWolfInfectionTarget: infectionContext.targetSeat },
  };
};

export const seedWolfInfectRevealResolver: ResolverFn = () => ({ valid: true });
