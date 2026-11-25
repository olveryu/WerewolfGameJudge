import { defineWerewolfStepAudio } from './audio';
import type { WerewolfRoleStepContext, WerewolfRoleStepDefinition } from './role';
import { getRoleAbilityLock } from './roleSteps';

interface ViewStepOptions {
  readonly id: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly stepTitle: string;
  readonly viewTitle: string;
  readonly content: (context: WerewolfRoleStepContext) => string;
  readonly reviewPhrase: (context: WerewolfRoleStepContext) => string;
}

export function createViewStep(options: ViewStepOptions): WerewolfRoleStepDefinition {
  return {
    id: options.id,
    title: options.stepTitle,
    audio: defineWerewolfStepAudio(options.roleId),
    actors: (context) =>
      context.state.seatedSeats.filter((seat) =>
        context.role.activeRoleIdsOf(seat).includes(options.roleId),
      ),
    actions: [
      {
        kind: 'view',
        key: options.id,
        name: options.viewTitle,
        title: options.viewTitle,
        content: options.content,
        reviewPhrase: options.reviewPhrase,
      },
    ],
    skippable: () => false,
    lock: getRoleAbilityLock,
    reviewSubject: () => options.roleName,
  };
}

export function getActingSeat(context: WerewolfRoleStepContext): number {
  if (context.seat === null) {
    throw new Error('[FAIL-FAST] A view action resolved without an acting seat');
  }
  return context.seat;
}
