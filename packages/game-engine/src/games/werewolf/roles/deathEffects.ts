export type AttackCause = 'wolfKill' | 'poison' | 'checkDeath';

export type DeathCause =
  AttackCause | 'wolfQueenLink' | 'bondedLink' | 'coupleLink' | 'dreamcatcherLink' | 'reflection';

export type DeathEffect =
  | {
      readonly kind: 'attack';
      readonly cause: AttackCause;
      readonly source: number | null;
      readonly target: number;
    }
  | {
      readonly kind: 'protect';
      readonly source: number;
      readonly target: number;
      readonly against: readonly AttackCause[];
      readonly conflictGroup: string | null;
    }
  | { readonly kind: 'shelter'; readonly source: number; readonly target: number }
  | {
      readonly kind: 'link';
      readonly source: number | null;
      readonly from: number;
      readonly to: number;
      readonly cause: 'wolfQueenLink' | 'bondedLink' | 'coupleLink' | 'dreamcatcherLink';
      readonly isMutual: boolean;
      readonly bypassShelter?: boolean;
    }
  | { readonly kind: 'immune'; readonly seat: number; readonly against: readonly AttackCause[] }
  | { readonly kind: 'reflect'; readonly seat: number; readonly against: readonly AttackCause[] }
  | {
      readonly kind: 'void';
      readonly scope:
        { readonly source: number } | { readonly cause: AttackCause; readonly target: number };
    };

export type DeathTraceEntry =
  | {
      readonly kind: 'attackBlocked';
      readonly cause: AttackCause;
      readonly target: number;
      readonly by: 'immunity' | 'protection' | 'void';
    }
  | {
      readonly kind: 'protectionConflict';
      readonly cause: AttackCause;
      readonly target: number;
      readonly group: string;
    }
  | { readonly kind: 'shelter'; readonly cause: DeathCause; readonly target: number }
  | {
      readonly kind: 'link';
      readonly cause: 'wolfQueenLink' | 'bondedLink' | 'coupleLink' | 'dreamcatcherLink';
      readonly from: number;
      readonly to: number;
    }
  | { readonly kind: 'reflection'; readonly source: number; readonly target: number };

export interface DeathResolution {
  readonly deaths: readonly number[];
  readonly causes: Readonly<Record<number, readonly DeathCause[]>>;
  readonly trace: readonly DeathTraceEntry[];
}

interface MutableResolution {
  readonly deaths: Set<number>;
  readonly causes: Map<number, Set<DeathCause>>;
  readonly trace: DeathTraceEntry[];
}

type LinkEffect = Extract<DeathEffect, { readonly kind: 'link' }>;

const LINK_RESOLUTION_ORDER = {
  wolfQueenLink: 0,
  bondedLink: 1,
  coupleLink: 2,
  dreamcatcherLink: 3,
} as const satisfies Readonly<Record<LinkEffect['cause'], number>>;

export function resolveDeathEffects(effects: readonly DeathEffect[]): DeathResolution {
  const voids = effects.filter((effect) => effect.kind === 'void');
  const activeEffects = effects.filter(
    (effect) => effect.kind === 'void' || !isSourceVoided(effect, voids),
  );
  const candidateAttacks = effects.filter((effect) => effect.kind === 'attack');
  const attacks = candidateAttacks.filter(
    (attack) => activeEffects.includes(attack) && !isAttackVoided(attack, voids),
  );
  const resolution: MutableResolution = { deaths: new Set(), causes: new Map(), trace: [] };

  for (const attack of candidateAttacks) {
    if (!attacks.includes(attack)) {
      resolution.trace.push({
        kind: 'attackBlocked',
        cause: attack.cause,
        target: attack.target,
        by: 'void',
      });
    }
  }
  resolveAttacks(attacks, activeEffects, resolution);
  applyShelters(activeEffects, resolution);

  const links = activeEffects
    .filter((effect): effect is LinkEffect => effect.kind === 'link')
    .sort(
      (first, second) => LINK_RESOLUTION_ORDER[first.cause] - LINK_RESOLUTION_ORDER[second.cause],
    );
  const processedLinks = new Set<string>();
  resolveLinks(links, activeEffects, processedLinks, resolution);
  resolveReflections(attacks, activeEffects, resolution);
  resolveLinks(links, activeEffects, processedLinks, resolution);

  return toDeathResolution(resolution);
}

function resolveAttacks(
  attacks: readonly Extract<DeathEffect, { readonly kind: 'attack' }>[],
  effects: readonly DeathEffect[],
  resolution: MutableResolution,
): void {
  for (const attack of attacks) {
    if (hasImmunity(attack, effects)) {
      resolution.trace.push({
        kind: 'attackBlocked',
        cause: attack.cause,
        target: attack.target,
        by: 'immunity',
      });
      continue;
    }
    if (isAttackProtected(attack, effects, resolution.trace)) {
      resolution.trace.push({
        kind: 'attackBlocked',
        cause: attack.cause,
        target: attack.target,
        by: 'protection',
      });
      continue;
    }
    recordDeath(attack.target, attack.cause, resolution);
  }
}

function hasImmunity(
  attack: Extract<DeathEffect, { readonly kind: 'attack' }>,
  effects: readonly DeathEffect[],
): boolean {
  return effects.some(
    (effect) =>
      effect.kind === 'immune' &&
      effect.seat === attack.target &&
      effect.against.includes(attack.cause),
  );
}

function isAttackProtected(
  attack: Extract<DeathEffect, { readonly kind: 'attack' }>,
  effects: readonly DeathEffect[],
  trace: DeathTraceEntry[],
): boolean {
  const applicable = effects.filter(
    (effect) =>
      effect.kind === 'protect' &&
      effect.target === attack.target &&
      effect.against.includes(attack.cause),
  );
  const groupCounts = new Map<string, number>();
  for (const effect of applicable) {
    if (effect.kind !== 'protect' || effect.conflictGroup === null) continue;
    groupCounts.set(effect.conflictGroup, (groupCounts.get(effect.conflictGroup) ?? 0) + 1);
  }
  let hasEffectiveProtection = false;
  for (const effect of applicable) {
    if (effect.kind !== 'protect') continue;
    if (effect.conflictGroup === null) {
      hasEffectiveProtection = true;
      continue;
    }
    const count = groupCounts.get(effect.conflictGroup) ?? 0;
    if (count > 1) {
      if (
        !trace.some(
          (entry) =>
            entry.kind === 'protectionConflict' &&
            entry.cause === attack.cause &&
            entry.target === attack.target &&
            entry.group === effect.conflictGroup,
        )
      ) {
        trace.push({
          kind: 'protectionConflict',
          cause: attack.cause,
          target: attack.target,
          group: effect.conflictGroup,
        });
      }
      continue;
    }
    hasEffectiveProtection = true;
  }
  return hasEffectiveProtection;
}

function applyShelters(effects: readonly DeathEffect[], resolution: MutableResolution): void {
  for (const effect of effects) {
    if (effect.kind !== 'shelter' || !resolution.deaths.has(effect.target)) continue;
    const causes = resolution.causes.get(effect.target);
    for (const cause of causes ?? []) {
      resolution.trace.push({ kind: 'shelter', cause, target: effect.target });
    }
    clearDeath(effect.target, resolution);
  }
}

function resolveLinks(
  links: readonly LinkEffect[],
  effects: readonly DeathEffect[],
  processed: Set<string>,
  resolution: MutableResolution,
): void {
  const shelters = effects.filter((effect) => effect.kind === 'shelter');
  let changed: boolean;
  do {
    changed = false;
    links.forEach((link, index) => {
      if (resolution.deaths.has(link.from)) {
        changed =
          resolveLinkDirection(
            link,
            link.from,
            link.to,
            `${index}:forward`,
            shelters,
            processed,
            resolution,
          ) || changed;
      }
      if (link.isMutual && resolution.deaths.has(link.to)) {
        changed =
          resolveLinkDirection(
            link,
            link.to,
            link.from,
            `${index}:reverse`,
            shelters,
            processed,
            resolution,
          ) || changed;
      }
    });
  } while (changed);
}

function resolveLinkDirection(
  link: LinkEffect,
  from: number,
  to: number,
  direction: string,
  shelters: readonly Extract<DeathEffect, { readonly kind: 'shelter' }>[],
  processed: Set<string>,
  resolution: MutableResolution,
): boolean {
  if (processed.has(direction)) return false;
  processed.add(direction);
  const sheltered = shelters.some((effect) => effect.target === to);
  if (sheltered && link.bypassShelter !== true) return false;
  const wasDead = resolution.deaths.has(to);
  if (wasDead && link.isMutual) return false;
  recordDeath(to, link.cause, resolution);
  resolution.trace.push({ kind: 'link', cause: link.cause, from, to });
  return !wasDead;
}

function resolveReflections(
  attacks: readonly Extract<DeathEffect, { readonly kind: 'attack' }>[],
  effects: readonly DeathEffect[],
  resolution: MutableResolution,
): void {
  for (const reflection of effects) {
    if (reflection.kind !== 'reflect') continue;
    for (const attack of attacks) {
      if (
        attack.target === reflection.seat &&
        reflection.against.includes(attack.cause) &&
        attack.source !== null
      ) {
        recordDeath(attack.source, 'reflection', resolution);
        resolution.trace.push({
          kind: 'reflection',
          source: attack.source,
          target: reflection.seat,
        });
      }
    }
  }
}

function isSourceVoided(
  effect: DeathEffect,
  voids: readonly Extract<DeathEffect, { readonly kind: 'void' }>[],
): boolean {
  const source = getEffectSource(effect);
  if (source === null) return false;
  return voids.some((voidEffect) => {
    const scope = voidEffect.scope;
    return 'source' in scope && scope.source === source;
  });
}

function getEffectSource(effect: DeathEffect): number | null {
  switch (effect.kind) {
    case 'attack':
    case 'protect':
    case 'shelter':
      return effect.source;
    case 'link':
      return effect.source;
    case 'void':
    case 'immune':
    case 'reflect':
      return null;
  }
}

function isAttackVoided(
  attack: Extract<DeathEffect, { readonly kind: 'attack' }>,
  voids: readonly Extract<DeathEffect, { readonly kind: 'void' }>[],
): boolean {
  return voids.some((voidEffect) => {
    const scope = voidEffect.scope;
    return 'cause' in scope && scope.cause === attack.cause && scope.target === attack.target;
  });
}

function recordDeath(seat: number, cause: DeathCause, resolution: MutableResolution): void {
  resolution.deaths.add(seat);
  const causes = resolution.causes.get(seat) ?? new Set<DeathCause>();
  causes.add(cause);
  resolution.causes.set(seat, causes);
}

function clearDeath(seat: number, resolution: MutableResolution): void {
  resolution.deaths.delete(seat);
  resolution.causes.delete(seat);
}

function toDeathResolution(resolution: MutableResolution): DeathResolution {
  const deaths = [...resolution.deaths].sort((first, second) => first - second);
  const causes: Record<number, readonly DeathCause[]> = {};
  for (const seat of deaths) {
    causes[seat] = [...(resolution.causes.get(seat) ?? [])];
  }
  return { deaths, causes, trace: resolution.trace };
}
