/**
 * The night report: what every seat did, why the settlement came out as it did, and who is out.
 * Everything is read from the step records and the settled night; nothing is re-derived.
 */

import { formatSeat } from '../../../../platform/room/formatSeat';
import { buildStepReviewLines, defineCopy, renderCopy } from '../../../../platform/steps';
import { type DeathReason, resolveDeathEffects } from '../../roles/deathEffects';
import { replaceCurrentRole } from '../../roles/identity';
import {
  applyWerewolfRoleFacts,
  createWerewolfRoleState,
  EMPTY_WEREWOLF_NIGHT_FACTS,
  getWerewolfRoleDefinition,
  mergeWerewolfNightFacts,
  WEREWOLF_STEP_DEFINITIONS,
} from '../../roles/nightPlan';
import {
  collectWerewolfDeathEffects,
  createWerewolfStepRuntime,
  requireWerewolfNightState,
} from '../../roles/nightRuntime';
import type { WerewolfNightState } from '../../roles/nightState';
import type { WerewolfNightFacts } from '../../roles/role';
import { getInfectionSettlementStepId } from '../../roles/seedWolf';
import { isValidRoleId, type RoleId } from '../models';
import type { GameState } from '../protocol/types';
import { deriveSheriffSection, type NightReviewSheriffSection } from './sheriffSection';

/** One seat's identity for the review grid. Seats are 0-based. */
export interface NightReviewIdentityEntry {
  readonly seat: number;
  /** Occupied seat's role; null for an empty seat or an unassigned role. */
  readonly roleId: RoleId | null;
  /** True when the seat has no occupant at all （空座）. */
  readonly isEmptySeat: boolean;
  /** False when the seat is in lastNightDeaths. */
  readonly isAlive: boolean;
}

/** One sentence of the night: an action a seat took, or an explanation of the settlement. */
export type NightReviewLine =
  | {
      readonly kind: 'action';
      readonly seat: number;
      readonly roleId: RoleId;
      readonly subject: string;
      readonly phrase: string;
      readonly result: string | null;
    }
  | { readonly kind: 'explanation'; readonly text: string };

/** A factual annotation on one death, for the report's death cards. */
export type NightReviewDeathNote =
  | { readonly kind: 'wolfVotes'; readonly votes: number }
  | { readonly kind: 'poisonedBy'; readonly actorRoleId: RoleId };

export interface NightReviewDeath {
  readonly seat: number;
  readonly reason: DeathReason | null;
  readonly note: NightReviewDeathNote | null;
}

export interface WerewolfNightReview {
  /** The cards left under the table; empty on a board without bottom cards. */
  readonly bottomCards: readonly RoleId[];
  /** Every action in night order, followed by the settlement explanations. */
  readonly lines: readonly NightReviewLine[];
  /** Who was out at dawn; empty after a peaceful night. */
  readonly deaths: readonly NightReviewDeath[];
  /** Per-seat identity entries sorted by seat. */
  readonly identities: readonly NightReviewIdentityEntry[];
  /**
   * Sheriff-election section. Absent when the game never held an election.
   * The election belongs to the game archive, not to one night: the section
   * reflects the election state at the moment the review is opened.
   */
  readonly sheriff?: NightReviewSheriffSection;
}

const COPY = defineCopy({
  conflict: '{seat}同守同救，保护抵消',
  poisonImmune: '{seat}免疫毒药',
  reflection: '{target}反弹伤害，{source}出局',
  infectionConverted: '{seat}{role}被种狼感染，转化为狼人',
  conversionVoided: '（已转化，技能无效）',
  infectionFailed: '{seat}感染失败',
  result: '（{title}：{text}）',
});

/** Build the night report from the settled night. */
export function getWerewolfNightReview(state: GameState): WerewolfNightReview {
  const night = requireWerewolfNightState(state);
  const actionLines = buildActionLines(state);
  const runtime = createWerewolfStepRuntime(null);
  const context = runtime.createContext(state, night.facts, null, { bySeat: {} });
  const resolution = resolveDeathEffects(collectWerewolfDeathEffects(context));
  const explanationLines = new Set<string>();
  for (const trace of resolution.trace) {
    if (trace.kind === 'protectionConflict') {
      explanationLines.add(renderCopy(COPY.conflict, { seat: formatSeat(trace.target) }));
    } else if (
      trace.kind === 'attackBlocked' &&
      trace.cause === 'poison' &&
      trace.by === 'immunity'
    ) {
      explanationLines.add(renderCopy(COPY.poisonImmune, { seat: formatSeat(trace.target) }));
    } else if (trace.kind === 'reflection') {
      explanationLines.add(
        renderCopy(COPY.reflection, {
          target: formatSeat(trace.target),
          source: formatSeat(trace.source),
        }),
      );
    }
  }
  for (const seat of night.roles.seatedSeats) {
    for (const roleId of context.role.activeRoleIdsOf(seat)) {
      const line = getWerewolfRoleDefinition(roleId).personalDaytimeView?.reviewLine(
        seat,
        resolution,
      );
      if (line != null) explanationLines.add(line);
    }
  }
  if (night.infection?.outcome === 'converted') {
    const { targetSeat } = night.infection;
    const formerRoleId = night.facts.conversions?.find(
      (conversion) => conversion.seat === targetSeat,
    )?.formerRoleIds[0];
    if (formerRoleId === undefined) {
      throw new Error(`[FAIL-FAST] Converted seat ${targetSeat} has no former role`);
    }
    explanationLines.add(
      renderCopy(COPY.infectionConverted, {
        seat: formatSeat(targetSeat),
        role: getWerewolfRoleDefinition(formerRoleId).card.name,
      }),
    );
  } else if (night.infection?.outcome === 'failed') {
    explanationLines.add(
      renderCopy(COPY.infectionFailed, { seat: formatSeat(night.infection.targetSeat) }),
    );
  }
  const sheriff = deriveSheriffSection(state);
  return {
    bottomCards: state.bottomCards ?? [],
    lines: [
      ...actionLines,
      ...[...explanationLines].map((text) => ({ kind: 'explanation' as const, text })),
    ],
    deaths: (state.lastNightDeaths ?? []).map((seat) => {
      const reason = state.deathReasons?.[seat] ?? null;
      return { seat, reason, note: buildDeathNote(state, night, seat, reason) };
    }),
    identities: Object.keys(state.players)
      .map(Number)
      .sort((first, second) => first - second)
      .map((seat) => {
        const player = state.players[seat];
        const role = night.roles.identities[seat]?.currentRole;
        if (role !== undefined && !isValidRoleId(role)) {
          throw new Error(`[FAIL-FAST] Invalid review role ${role}`);
        }
        return {
          seat,
          roleId: role ?? player?.role ?? null,
          isEmptySeat: player == null,
          isAlive: !(state.lastNightDeaths ?? []).includes(seat),
        };
      }),
    ...(sheriff === undefined ? {} : { sheriff }),
  };
}

/** How many wolf votes landed on a wolf-killed seat, or whose poison killed a poisoned one. */
function buildDeathNote(
  state: GameState,
  night: WerewolfNightState,
  seat: number,
  reason: DeathReason | null,
): NightReviewDeathNote | null {
  if (reason === 'wolfKill') {
    const votes = (night.facts.wolfVotes ?? []).filter((vote) => vote.landingSeat === seat).length;
    return votes === 0 ? null : { kind: 'wolfVotes', votes };
  }
  if (reason !== 'poison') return null;
  const poisoning = night.emissions.find((emission) =>
    emission.facts.deathEffects?.some(
      (effect) => effect.kind === 'attack' && effect.cause === 'poison' && effect.target === seat,
    ),
  );
  return poisoning === undefined
    ? null
    : { kind: 'poisonedBy', actorRoleId: findStepRole(state.templateRoles, poisoning.stepId) };
}

function buildActionLines(state: GameState): readonly NightReviewLine[] {
  const night = requireWerewolfNightState(state);
  const seats = night.roles.seatedSeats.map((seat) => {
    const role = night.roles.identities[seat]?.dealtRole;
    if (role === undefined || !isValidRoleId(role)) {
      throw new Error(`[FAIL-FAST] Missing dealt role for seat ${seat}`);
    }
    return { seat, role };
  });
  let roles = createWerewolfRoleState({
    seats,
    templateRoles: state.templateRoles,
    seerLabelMap: state.seerLabelMap ?? {},
    witchCanSelfHeal: night.roles.rules.witchCanSelfHeal,
  });
  let facts: WerewolfNightFacts = EMPTY_WEREWOLF_NIGHT_FACTS;
  const lines: NightReviewLine[] = [];
  const runtime = createWerewolfStepRuntime(null);
  const convertedSeat =
    night.infection?.outcome === 'converted' ? night.infection.targetSeat : null;
  const conversion = night.facts.conversions?.find((entry) => entry.seat === convertedSeat);
  let isConversionApplied = false;
  for (const stepId of night.slice.order) {
    const reviewNight = {
      ...night,
      roles,
      facts,
      slice: { ...night.slice, order: [stepId] },
    };
    const reviewState = { ...state, nightState: reviewNight };
    const definition = runtime.definitions[stepId];
    if (definition === undefined) throw new Error(`[FAIL-FAST] Unknown review step ${stepId}`);
    const record = night.slice.records[stepId] ?? { bySeat: {} };
    const context = runtime.createContext(reviewState, facts, null, record);
    if (definition.audience !== 'allSeats' && definition.reviewSummary === undefined) {
      const resultsAdded = new Set<number>();
      for (const line of buildStepReviewLines(runtime, reviewState)) {
        const result = record.bySeat[line.seat]?.result;
        const actorContext = runtime.createContext(reviewState, facts, line.seat, record);
        const subject = definition.reviewSubject(actorContext, line.seat);
        if (!line.text.startsWith(subject)) {
          throw new Error(`[FAIL-FAST] Review line for ${stepId} has no actor subject`);
        }
        let renderedResult: string | null = null;
        if (
          result != null &&
          !resultsAdded.has(line.seat) &&
          definition.renderResult !== undefined
        ) {
          const rendered = definition.renderResult(actorContext, result);
          renderedResult = renderCopy(COPY.result, rendered);
          resultsAdded.add(line.seat);
        }
        const isVoidedByConversion =
          conversion !== undefined &&
          !isConversionApplied &&
          line.seat === conversion.seat &&
          line.isDone &&
          WEREWOLF_STEP_DEFINITIONS[stepId]?.survivesConversion !== true;
        lines.push({
          kind: 'action',
          seat: line.seat,
          roleId: stepId === 'wolfKill' ? 'wolf' : findStepRole(state.templateRoles, stepId),
          subject,
          phrase: `${line.text.slice(subject.length)}${isVoidedByConversion ? COPY.conversionVoided : ''}`,
          result: renderedResult,
        });
      }
    }
    for (const text of definition.reviewSummary?.(context) ?? []) {
      lines.push({ kind: 'explanation', text });
    }
    for (const emission of night.emissions.filter((entry) => entry.stepId === stepId)) {
      roles = applyWerewolfRoleFacts(roles, emission.facts);
      facts = mergeWerewolfNightFacts(facts, emission.facts);
    }
    if (stepId === 'wolfKill' && night.wolfKill?.attack != null) {
      facts = mergeWerewolfNightFacts(facts, { deathEffects: [night.wolfKill.attack] });
    }
    if (conversion !== undefined && !isConversionApplied) {
      const settledState = { ...state, nightState: { ...night, roles, facts } };
      const settledContext = runtime.createContext(settledState, facts, null, { bySeat: {} });
      if (
        getInfectionSettlementStepId(
          night.slice.order,
          WEREWOLF_STEP_DEFINITIONS,
          settledContext,
        ) === stepId
      ) {
        roles = {
          ...roles,
          identities: replaceCurrentRole(roles.identities, conversion.seat, 'wolf'),
        };
        facts = mergeWerewolfNightFacts(facts, {
          deathEffects: [{ kind: 'void', scope: { cause: 'wolfKill', target: conversion.seat } }],
          conversions: [conversion],
        });
        isConversionApplied = true;
      }
    }
  }
  return lines;
}

function findStepRole(templateRoles: readonly RoleId[], stepId: string): RoleId {
  const role = templateRoles.find((roleId) =>
    getWerewolfRoleDefinition(roleId).steps.some((step) => step.id === stepId),
  );
  if (role === undefined) throw new Error(`[FAIL-FAST] Review step ${stepId} has no role`);
  return role;
}
