import { formatSeat } from '../../../../platform/room/formatSeat';
import { buildStepReviewLines, defineCopy, renderCopy } from '../../../../platform/steps';
import { resolveDeathEffects } from '../../roles/deathEffects';
import { replaceCurrentRole } from '../../roles/identity';
import { resolveSelectedSeat } from '../../roles/location';
import {
  applyWerewolfRoleFacts,
  createWerewolfRoleState,
  EMPTY_WEREWOLF_NIGHT_FACTS,
  getWerewolfRoleDefinition,
  mergeWerewolfNightFacts,
} from '../../roles/nightPlan';
import {
  collectWerewolfDeathEffects,
  createWerewolfStepRuntime,
  requireWerewolfNightState,
} from '../../roles/nightRuntime';
import type { WerewolfNightFacts } from '../../roles/role';
import { isValidRoleId, type RoleId } from '../models';
import type { GameState, ResolvedWolfKillVerdict } from '../protocol/types';
import type {
  NightReviewActionEntry,
  NightReviewIdentityEntry,
  NightReviewStepLine,
} from './nightReview';

const COPY = defineCopy({
  conflict: '{seat}同守同救，保护抵消',
  poisonImmune: '{seat}免疫毒药',
  reflection: '{target}反弹伤害，{source}出局',
  infectionConverted: '{seat}感染成功，转化为狼人',
  infectionFailed: '{seat}感染失败',
  result: '（{title}：{text}）',
});

/** Project the spec-driven records and settlement into the existing report contract. */
export function buildSpecNightReview(state: GameState): {
  readonly actions: NightReviewActionEntry[];
  readonly identities: NightReviewIdentityEntry[];
  readonly stepLines: readonly NightReviewStepLine[];
} {
  const night = requireWerewolfNightState(state);
  const actions = buildSummaryEntries(state);
  const stepLines = buildActionLines(state);
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
  if (night.infection?.outcome === 'converted') {
    explanationLines.add(
      renderCopy(COPY.infectionConverted, { seat: formatSeat(night.infection.targetSeat) }),
    );
  } else if (night.infection?.outcome === 'failed') {
    explanationLines.add(
      renderCopy(COPY.infectionFailed, { seat: formatSeat(night.infection.targetSeat) }),
    );
  }
  return {
    actions,
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
    stepLines: [
      ...stepLines,
      ...[...explanationLines].map((text) => ({ kind: 'explanation' as const, text })),
    ],
  };
}

function buildActionLines(state: GameState): readonly NightReviewStepLine[] {
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
  const lines: NightReviewStepLine[] = [];
  const runtime = createWerewolfStepRuntime(null);
  for (const stepId of night.slice.order) {
    if (stepId === 'seedWolfInfectReveal' && night.infection?.outcome === 'converted') {
      roles = {
        ...roles,
        identities: replaceCurrentRole(roles.identities, night.infection.targetSeat, 'wolf'),
      };
      facts = mergeWerewolfNightFacts(facts, {
        deathEffects: [
          { kind: 'void', scope: { cause: 'wolfKill', target: night.infection.targetSeat } },
        ],
      });
    }
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
        lines.push({
          kind: 'action',
          seat: line.seat,
          roleId: stepId === 'wolfKill' ? 'wolf' : findStepRole(state.templateRoles, stepId),
          subject,
          phrase: line.text.slice(subject.length),
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
  }
  return lines;
}

function landingVerdict(
  verdict: ResolvedWolfKillVerdict | null | undefined,
  state: GameState,
): ResolvedWolfKillVerdict | null | undefined {
  if (verdict == null || !('targetSeat' in verdict)) return verdict;
  return {
    ...verdict,
    targetSeat: resolveSelectedSeat(
      verdict.targetSeat,
      requireWerewolfNightState(state).roles.location,
    ),
  };
}

function buildSummaryEntries(state: GameState): NightReviewActionEntry[] {
  const night = requireWerewolfNightState(state);
  const entries: NightReviewActionEntry[] = [];
  if (state.bottomCards !== undefined && state.bottomCards.length > 0) {
    entries.push({ kind: 'bottomCards', roleIds: [...state.bottomCards] });
  }
  if (night.slice.order.includes('wolfKill')) {
    const votes = night.facts.wolfVotes ?? [];
    if (night.wolfKill?.verdict === null) {
      entries.push({
        kind: 'wolfGiveUp',
        reason: state.templateRoles.includes('poisoner') ? 'poisonerPresent' : 'nightmareBlock',
      });
    } else {
      entries.push({
        kind: 'wolfAttack',
        votes: votes.flatMap((vote) =>
          vote.landingSeat === null
            ? []
            : [{ voterSeat: vote.actorSeat, targetSeat: vote.landingSeat }],
        ),
        abstainSeats: votes
          .filter((vote) => vote.chosenSeat === null)
          .map((vote) => vote.actorSeat),
        verdict: landingVerdict(night.wolfKill?.verdict, state),
      });
    }
  }
  for (const emission of night.emissions) {
    for (const effect of emission.facts.deathEffects ?? []) {
      if (effect.kind === 'attack' && effect.cause === 'poison' && effect.source !== null) {
        entries.push({
          kind: 'poison',
          actorSeat: effect.source,
          actorRoleId: emission.stepId === 'witchAction' ? 'witch' : 'poisoner',
          targetSeat: effect.target,
        });
      } else if (
        effect.kind === 'protect' &&
        emission.facts.resourceUses?.some((use) => use.resource === 'antidote') === true
      ) {
        entries.push({ kind: 'save', actorSeat: effect.source, targetSeat: effect.target });
      }
    }
  }
  for (const [stepId, record] of Object.entries(night.slice.records)) {
    for (const [seatKey, seatRecord] of Object.entries(record?.bySeat ?? {})) {
      const result = seatRecord?.result;
      if (result == null || result.kind === 'cardSelection') continue;
      const actorRoleId = findStepRole(state.templateRoles, stepId);
      entries.push({
        kind: 'check',
        actorSeat: Number(seatKey),
        actorRoleId,
        targetSeat: result.landingSeat,
        result:
          result.kind === 'factionCheck'
            ? result.faction === 'wolf'
              ? '狼人'
              : '好人'
            : result.roleId,
        resultFormat: result.kind === 'factionCheck' ? 'factionCheck' : 'roleName',
      });
    }
  }
  const deaths = state.lastNightDeaths ?? [];
  entries.push(
    deaths.length === 0
      ? { kind: 'peacefulNight' }
      : {
          kind: 'deaths',
          deaths: deaths.map((seat) => ({ seat, reason: state.deathReasons?.[seat] ?? null })),
        },
  );
  return entries;
}

function findStepRole(templateRoles: readonly RoleId[], stepId: string): RoleId {
  const role = templateRoles.find((roleId) =>
    getWerewolfRoleDefinition(roleId).steps.some((step) => step.id === stepId),
  );
  if (role === undefined) throw new Error(`[FAIL-FAST] Review step ${stepId} has no role`);
  return role;
}
