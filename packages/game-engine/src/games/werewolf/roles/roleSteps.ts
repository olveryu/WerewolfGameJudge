import { formatSeat } from '../../../platform/room/formatSeat';
import { defineCopy, renderCopy } from '../../../platform/steps';
import { defineWerewolfStepAudio } from './audio';
import { resolveTargetSelection, type TargetSelection } from './location';
import type {
  WerewolfBottomCard,
  WerewolfNightFacts,
  WerewolfRoleStepContext,
  WerewolfRoleStepDefinition,
  WerewolfRoleStepResult,
} from './role';

const ROLE_STEP_COPY = defineCopy({
  selfTargetDisallowed: '不能选择自己',
  wolfTeammateDisallowed: '不能选择狼人阵营的玩家',
  actualLanding: '（实际为{seat}）',
  riftReflected: '（被时间裂隙反弹至自身）',
  good: '好人',
  wolf: '狼人',
  factionCheckResult: '{seat}是{faction}',
  identityCheckResult: '{seat}是{role}',
  wolfCardRequired: '底牌中有狼人阵营的牌，必须选择狼人',
  chooseCard: '选择{role}',
});

export const IDOL_ACTION_COPY = defineCopy({
  action: '选择榜样',
  prompt: '请选择你的榜样',
  chosen: '选{seat}为榜样',
});

export function formatIdolSelection(seats: readonly number[]): string {
  const seat = seats[0];
  return seat === undefined
    ? IDOL_ACTION_COPY.action
    : renderCopy(IDOL_ACTION_COPY.chosen, { seat: formatSeat(seat) });
}

export interface SingleTargetStepOptions {
  readonly id: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly audioKey?: string;
  readonly actionName: string;
  readonly prompt?: string;
  readonly phrase?: (seats: readonly number[]) => string;
  readonly skippable: boolean;
  readonly canTargetSelf: boolean;
  readonly actorAvailable?: (context: WerewolfRoleStepContext, seat: number) => boolean;
  readonly targetUnavailableReason?: (
    context: WerewolfRoleStepContext,
    targetSeat: number,
  ) => string | null;
  readonly situationHints?: (context: WerewolfRoleStepContext) => readonly string[];
  readonly ruleHints?: (context: WerewolfRoleStepContext) => readonly string[];
  readonly selectionEffects?: (
    context: WerewolfRoleStepContext,
    selection: { readonly chosenSeat: number; readonly landingSeat: number },
  ) => Pick<WerewolfNightFacts, 'disabledAbilities' | 'deathEffects'> &
    Partial<
      Pick<
        WerewolfNightFacts,
        | 'reflections'
        | 'identityChanges'
        | 'locationSwaps'
        | 'factionChanges'
        | 'wolfGirlConfessions'
      >
    >;
  readonly result?: (
    context: WerewolfRoleStepContext,
    selection: { readonly chosenSeat: number; readonly landingSeat: number },
  ) => WerewolfRoleStepResult | undefined;
  readonly renderResult?: (
    context: WerewolfRoleStepContext,
    result: WerewolfRoleStepResult,
  ) => { readonly title: string; readonly text: string };
  readonly reviewSuffix?: (context: WerewolfRoleStepContext, chosenSeat: number) => string | null;
}

export function getActingSeat(context: WerewolfRoleStepContext): number {
  if (context.seat === null) {
    throw new Error('[FAIL-FAST] A role action resolved without an acting seat');
  }
  return context.seat;
}

/** Why the acting seat cannot use any skill tonight, or null when it can. */
export function getRoleAbilityLockReason(context: WerewolfRoleStepContext): string | null {
  if (context.seat === null) return null;
  const lock = context.facts.disabledAbilities.find(
    (ability) => ability.seat === context.seat && ability.roleId === '*',
  );
  return lock === undefined ? null : context.abilityLockReasonOf(lock.sourceRoleId);
}

/**
 * A wolf the pack recognises: one that meets with it at the wolf vote. Wolves that stay
 * unknown to the pack and players converted tonight are left unmarked, so a choice list
 * never tells the actor more than they are entitled to know.
 */
export function isKnownWolfTeammate(context: WerewolfRoleStepContext, seat: number): boolean {
  return (
    context.doesRoleVoteWithWolves(context.role.roleOf(seat)) &&
    !(context.facts.conversions ?? []).some((conversion) => conversion.seat === seat)
  );
}

/** The reason a recognised wolf teammate cannot be chosen, or null for any other seat. */
export function getWolfTeammateRestriction(
  context: WerewolfRoleStepContext,
  seat: number,
): string | null {
  return isKnownWolfTeammate(context, seat) ? ROLE_STEP_COPY.wolfTeammateDisallowed : null;
}

/**
 * The report suffix for where a targeted skill really went: the seat behind a magician swap,
 * and whether the time rift turned the skill back onto its user.
 */
export function describeTargetLanding(
  context: WerewolfRoleStepContext,
  chosenSeat: number,
): string {
  const swappedSeat = context.role.landing(chosenSeat);
  const swapped =
    swappedSeat === chosenSeat
      ? ''
      : renderCopy(ROLE_STEP_COPY.actualLanding, { seat: formatSeat(swappedSeat) });
  const isReflected = resolveRoleTarget(context, chosenSeat).landingSeat !== swappedSeat;
  return isReflected ? swapped + ROLE_STEP_COPY.riftReflected : swapped;
}

export function resolveRoleTarget(
  context: WerewolfRoleStepContext,
  chosenSeat: number,
): TargetSelection {
  const selection = resolveTargetSelection(chosenSeat, context.state.location);
  const isReflected = context.facts.reflections?.some(
    (reflection) => reflection.seat === selection.landingSeat,
  );
  if (
    context.seat !== null &&
    context.teamOfRole(context.role.roleOf(context.seat)) === 'good' &&
    isReflected === true
  ) {
    return { ...selection, landingSeat: context.seat };
  }
  return selection;
}

export function createFactionCheckResult(
  context: WerewolfRoleStepContext,
  selection: { readonly chosenSeat: number; readonly landingSeat: number },
  transform: 'identity' | 'invert' | 'random',
): WerewolfRoleStepResult {
  const seenRole = context.role.seenRole(selection.landingSeat);
  const isWolf = context.teamOfRole(seenRole) === 'wolf';
  const resultIsWolf =
    transform === 'identity'
      ? isWolf
      : transform === 'invert'
        ? !isWolf
        : context.randomBoolean()
          ? isWolf
          : !isWolf;
  return {
    kind: 'factionCheck',
    ...selection,
    faction: resultIsWolf ? 'wolf' : 'good',
  };
}

export function createCheckEffects(
  context: WerewolfRoleStepContext,
  selection: { readonly chosenSeat: number; readonly landingSeat: number },
): Pick<WerewolfNightFacts, 'disabledAbilities' | 'deathEffects'> {
  const reaction = context.checkReactionOfRole(context.role.roleOf(selection.landingSeat));
  return {
    disabledAbilities: [],
    deathEffects:
      reaction === undefined
        ? []
        : [
            {
              kind: 'attack',
              cause: 'checkDeath',
              source: getActingSeat(context),
              target: selection.landingSeat,
            },
          ],
  };
}

export function createIdentityCheckResult(
  context: WerewolfRoleStepContext,
  selection: { readonly chosenSeat: number; readonly landingSeat: number },
): WerewolfRoleStepResult {
  return {
    kind: 'identityCheck',
    ...selection,
    roleId: context.role.seenRole(selection.landingSeat),
  };
}

export function renderFactionCheckResult(
  result: WerewolfRoleStepResult,
  title: string,
): { readonly title: string; readonly text: string } {
  if (result.kind !== 'factionCheck') {
    throw new Error('[FAIL-FAST] Expected a faction-check result');
  }
  return {
    title,
    text: renderCopy(ROLE_STEP_COPY.factionCheckResult, {
      seat: formatSeat(result.chosenSeat),
      faction: result.faction === 'wolf' ? ROLE_STEP_COPY.wolf : ROLE_STEP_COPY.good,
    }),
  };
}

export function renderIdentityCheckResult(
  context: WerewolfRoleStepContext,
  result: WerewolfRoleStepResult,
  title: string,
): { readonly title: string; readonly text: string } {
  if (result.kind !== 'identityCheck') {
    throw new Error('[FAIL-FAST] Expected an identity-check result');
  }
  return {
    title,
    text: renderCopy(ROLE_STEP_COPY.identityCheckResult, {
      seat: formatSeat(result.chosenSeat),
      role: context.roleNameOf(result.roleId),
    }),
  };
}

export function createSingleTargetStep(
  options: SingleTargetStepOptions,
): WerewolfRoleStepDefinition {
  return {
    id: options.id,
    title: options.actionName,
    audio: defineWerewolfStepAudio(options.audioKey ?? options.roleId),
    actors: (context) =>
      context.state.seatedSeats.filter(
        (seat) =>
          context.role.activeRoleIdsOf(seat).includes(options.roleId) &&
          (options.actorAvailable?.(context, seat) ?? true),
      ),
    actions: [
      {
        kind: 'pickSeats',
        key: options.id,
        name: options.actionName,
        count: { min: 1, max: 1 },
        ...(options.prompt === undefined ? {} : { prompt: options.prompt }),
        ...(options.phrase === undefined ? {} : { phrase: options.phrase }),
        seats: (context) =>
          context.state.seatedSeats.map((seat) => ({
            seat,
            unavailableReason: getUnavailableReason(context, options, seat),
          })),
        resolve: (context, [chosenSeat]) => {
          if (chosenSeat === undefined || context.seat === null) {
            throw new Error(`[FAIL-FAST] ${options.id} resolved without one actor and target`);
          }
          const selection = resolveRoleTarget(context, chosenSeat);
          const selectionEffects = options.selectionEffects?.(context, selection);
          const facts: WerewolfNightFacts = {
            selections: [
              {
                roleId: options.roleId,
                actorSeat: context.seat,
                ...selection,
              },
            ],
            identityChanges: selectionEffects?.identityChanges ?? [],
            cardSelections: [],
            disabledAbilities: selectionEffects?.disabledAbilities ?? [],
            deathEffects: selectionEffects?.deathEffects ?? [],
            ...(selectionEffects?.locationSwaps === undefined
              ? {}
              : { locationSwaps: selectionEffects.locationSwaps }),
            ...(selectionEffects?.factionChanges === undefined
              ? {}
              : { factionChanges: selectionEffects.factionChanges }),
            ...(selectionEffects?.wolfGirlConfessions === undefined
              ? {}
              : { wolfGirlConfessions: selectionEffects.wolfGirlConfessions }),
            ...(selectionEffects?.reflections === undefined
              ? {}
              : { reflections: selectionEffects.reflections }),
          };
          const wasRedirected =
            selection.landingSeat !== context.role.landing(selection.chosenSeat);
          const resultSelection = wasRedirected
            ? { ...selection, chosenSeat: selection.landingSeat }
            : selection;
          const result = options.result?.(context, resultSelection);
          return {
            facts,
            ...(result === undefined ? {} : { result }),
          };
        },
      },
    ],
    skippable: () => options.skippable,
    lock: getRoleAbilityLockReason,
    ...(options.situationHints === undefined ? {} : { situationHints: options.situationHints }),
    ...(options.ruleHints === undefined ? {} : { ruleHints: options.ruleHints }),
    ...(options.renderResult === undefined ? {} : { renderResult: options.renderResult }),
    reviewSubject: () => options.roleName,
    reviewSuffix: (context, submission) => {
      const chosenSeat = submission.seats[0];
      if (chosenSeat === undefined) return null;
      const detail = options.reviewSuffix?.(context, chosenSeat) ?? '';
      return describeTargetLanding(context, chosenSeat) + detail || null;
    },
  };
}

export interface GroupConfirmStepOptions {
  readonly id: string;
  readonly roleName: string;
  readonly title: string;
  readonly content: (context: WerewolfRoleStepContext) => string;
}

export function createGroupConfirmStep(
  options: GroupConfirmStepOptions,
): WerewolfRoleStepDefinition {
  return {
    id: options.id,
    title: options.title,
    audio: defineWerewolfStepAudio(options.id),
    actors: (context) => context.state.seatedSeats,
    audience: 'allSeats',
    actions: [
      {
        kind: 'view',
        key: options.id,
        name: options.title,
        title: options.title,
        content: options.content,
      },
    ],
    skippable: () => false,
    reviewSubject: () => options.roleName,
  };
}

export interface CardSelectionStepOptions {
  readonly id: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly actionName: string;
  readonly hint: (cards: readonly WerewolfBottomCard[]) => string;
  readonly resultTitle: string;
  readonly identityChange: 'replaceCurrentRole' | 'grantBorrowedAbility';
  readonly mustChooseWolfWhenAvailable?: boolean;
  /** Why this role may not take the card, or null when it may. */
  readonly cardUnavailableReason?: (card: WerewolfBottomCard) => string | null;
}

export function createCardSelectionStep(
  options: CardSelectionStepOptions,
): WerewolfRoleStepDefinition {
  return {
    id: options.id,
    // The card taken is who the player is, not a skill used on someone else.
    survivesConversion: true,
    title: options.actionName,
    audio: defineWerewolfStepAudio(options.roleId),
    actors: (context) =>
      context.state.seatedSeats.filter(
        (seat) =>
          context.role.activeRoleIdsOf(seat).includes(options.roleId) ||
          context.record.bySeat[seat]?.submissions.some(
            (submission) => submission.actionKey === options.id,
          ) === true,
      ),
    actions: [
      {
        kind: 'pickCard',
        key: options.id,
        name: options.actionName,
        cards: (context) => {
          const cards = context.bottomCardsOf(getActingSeat(context), options.roleId);
          return cards.map((card) => ({
            index: card.index,
            label: card.label,
            unavailableReason: getCardUnavailableReason(context, options, card, cards),
          }));
        },
        hint: (context) =>
          options.hint(context.bottomCardsOf(getActingSeat(context), options.roleId)),
        phrase: (card) => renderCopy(ROLE_STEP_COPY.chooseCard, { role: card.label }),
        resolve: (context, cardIndex) => {
          const seat = getActingSeat(context);
          const cards = context.bottomCardsOf(seat, options.roleId);
          const card = cards.find((candidate) => candidate.index === cardIndex);
          if (card === undefined) {
            throw new Error(`[FAIL-FAST] ${options.id} resolved with an unknown card`);
          }
          if (getCardUnavailableReason(context, options, card, cards) !== null) {
            throw new Error(`[FAIL-FAST] ${options.id} resolved with an unavailable card`);
          }
          const identityChange =
            options.identityChange === 'replaceCurrentRole'
              ? { kind: 'replaceCurrentRole' as const, seat, roleId: card.roleId }
              : { kind: 'grantBorrowedAbility' as const, seat, roleId: card.roleId };
          return {
            facts: {
              selections: [],
              identityChanges: [identityChange],
              cardSelections: [{ roleId: options.roleId, actorSeat: seat, cardIndex }],
              disabledAbilities: [],
              deathEffects: [],
              ...(options.identityChange === 'grantBorrowedAbility'
                ? { sightOverrides: [{ seat, roleId: card.roleId }] }
                : {}),
            },
            result: { kind: 'cardSelection', roleId: card.roleId },
          };
        },
      },
    ],
    skippable: () => false,
    reviewSubject: () => options.roleName,
    renderResult: (context, result) => {
      if (result.kind !== 'cardSelection') {
        throw new Error(`[FAIL-FAST] ${options.id} received an incompatible result`);
      }
      return {
        title: options.resultTitle,
        text: context.roleNameOf(result.roleId),
      };
    },
  };
}

function getCardUnavailableReason(
  context: WerewolfRoleStepContext,
  options: CardSelectionStepOptions,
  card: WerewolfBottomCard,
  cards: readonly WerewolfBottomCard[],
): string | null {
  const ownReason = options.cardUnavailableReason?.(card) ?? null;
  if (ownReason !== null) return ownReason;
  if (
    options.mustChooseWolfWhenAvailable === true &&
    cards.some((candidate) => candidate.faction === 'wolf') &&
    card.faction !== 'wolf'
  ) {
    return ROLE_STEP_COPY.wolfCardRequired;
  }
  return null;
}

function getUnavailableReason(
  context: WerewolfRoleStepContext,
  options: SingleTargetStepOptions,
  targetSeat: number,
): string | null {
  if (!options.canTargetSelf && targetSeat === context.seat) {
    return ROLE_STEP_COPY.selfTargetDisallowed;
  }
  const reason = options.targetUnavailableReason?.(context, targetSeat);
  if (reason !== undefined && reason !== null) return reason;
  return null;
}
