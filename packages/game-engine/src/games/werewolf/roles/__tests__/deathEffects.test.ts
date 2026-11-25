import { type DeathEffect, resolveDeathEffects } from '../deathEffects';

describe('werewolf death effects', () => {
  it('only lets protections block the attack causes they declare', () => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'poison', source: 0, target: 2 },
      {
        kind: 'protect',
        source: 1,
        target: 2,
        against: ['wolfKill'],
        conflictGroup: null,
      },
    ]);

    expect(result.deaths).toEqual([2]);
    expect(result.causes[2]).toEqual(['poison']);
  });

  it('treats the guard-and-antidote pair as a declared conflict', () => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'wolfKill', source: 0, target: 2 },
      {
        kind: 'protect',
        source: 3,
        target: 2,
        against: ['wolfKill'],
        conflictGroup: 'wolfSave',
      },
      {
        kind: 'protect',
        source: 4,
        target: 2,
        against: ['wolfKill'],
        conflictGroup: 'wolfSave',
      },
    ]);

    expect(result.deaths).toEqual([2]);
    expect(result.trace).toContainEqual({
      kind: 'protectionConflict',
      cause: 'wolfKill',
      target: 2,
      group: 'wolfSave',
    });
  });

  it('allows an independent effective protection to survive a different conflict', () => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'wolfKill', source: 0, target: 2 },
      {
        kind: 'protect',
        source: 3,
        target: 2,
        against: ['wolfKill'],
        conflictGroup: 'wolfSave',
      },
      {
        kind: 'protect',
        source: 4,
        target: 2,
        against: ['wolfKill'],
        conflictGroup: 'wolfSave',
      },
      {
        kind: 'protect',
        source: 5,
        target: 2,
        against: ['wolfKill'],
        conflictGroup: null,
      },
    ]);

    expect(result.deaths).toEqual([]);
    expect(result.trace).toContainEqual({
      kind: 'protectionConflict',
      cause: 'wolfKill',
      target: 2,
      group: 'wolfSave',
    });
    expect(result.trace).toContainEqual({
      kind: 'attackBlocked',
      cause: 'wolfKill',
      target: 2,
      by: 'protection',
    });
  });

  it('applies immunity by cause and voids an infected wolf attack', () => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'wolfKill', source: 0, target: 2 },
      { kind: 'attack', cause: 'poison', source: 1, target: 3 },
      { kind: 'immune', seat: 2, against: ['wolfKill'] },
      { kind: 'immune', seat: 3, against: ['poison'] },
      { kind: 'void', scope: { cause: 'wolfKill', target: 2 } },
    ]);

    expect(result.deaths).toEqual([]);
    expect(result.trace).toContainEqual({
      kind: 'attackBlocked',
      cause: 'poison',
      target: 3,
      by: 'immunity',
    });
  });

  it.each(['wolfKill', 'poison', 'checkDeath'] as const)(
    'applies night-wide immunity to %s attacks',
    (cause) => {
      const result = resolveDeathEffects([
        { kind: 'attack', cause, source: 0, target: 2 },
        { kind: 'immune', seat: 2, against: ['nightDamage'] },
      ]);

      expect(result.deaths).toEqual([]);
      expect(result.trace).toContainEqual({
        kind: 'attackBlocked',
        cause,
        target: 2,
        by: 'immunity',
      });
    },
  );

  it.each([
    'wolfQueenLink',
    'bondedLink',
    'coupleLink',
    'dreamcatcherLink',
    'scarletLink',
  ] as const)('applies night-wide immunity to %s', (cause) => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'wolfKill', source: 4, target: 3 },
      {
        kind: 'link',
        source: 3,
        from: 3,
        to: 2,
        cause,
        isMutual: false,
        bypassSurvival: true,
      },
      { kind: 'immune', seat: 2, against: ['nightDamage'] },
    ]);

    expect(result.deaths).toEqual([3]);
    expect(result.trace).toContainEqual({
      kind: 'deathBlocked',
      cause,
      target: 2,
    });
  });

  it('applies night-wide immunity to reflected damage', () => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'poison', source: 0, target: 2 },
      { kind: 'reflect', seat: 2, against: ['poison'] },
      { kind: 'immune', seat: 0, against: ['nightDamage'] },
    ]);

    expect(result.deaths).toEqual([2]);
    expect(result.trace).toContainEqual({
      kind: 'deathBlocked',
      cause: 'reflection',
      target: 0,
    });
  });

  it('clears direct deaths through shelter but allows the dreamer death link', () => {
    const effects: DeathEffect[] = [
      { kind: 'attack', cause: 'checkDeath', source: 0, target: 2 },
      { kind: 'shelter', source: 3, target: 2 },
      {
        kind: 'link',
        source: 3,
        from: 3,
        to: 2,
        cause: 'dreamcatcherLink',
        isMutual: false,
        bypassShelter: true,
      },
    ];

    expect(resolveDeathEffects(effects).deaths).toEqual([]);
    expect(
      resolveDeathEffects([
        { kind: 'attack', cause: 'wolfKill', source: 0, target: 3 },
        { kind: 'shelter', source: 3, target: 2 },
        ...effects.slice(2),
      ]).deaths,
    ).toEqual([2, 3]);
  });

  it('reports a shelter that prevents a death link from bypassing it', () => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'wolfKill', source: 0, target: 3 },
      { kind: 'shelter', source: 2, target: 2, bypassable: false },
      {
        kind: 'link',
        source: 2,
        from: 3,
        to: 2,
        cause: 'dreamcatcherLink',
        isMutual: false,
        bypassShelter: true,
      },
    ]);

    expect(result.deaths).toEqual([3]);
    expect(result.trace).toContainEqual({
      kind: 'shelter',
      cause: 'dreamcatcherLink',
      target: 2,
    });
  });

  it('lets an unavoidable link bypass shelter and wounds while continuing death chains', () => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'wolfKill', source: 0, target: 3 },
      { kind: 'shelter', source: 2, target: 2, bypassable: false },
      { kind: 'wound', seat: 2, against: ['scarletLink'] },
      {
        kind: 'link',
        source: 3,
        from: 3,
        to: 2,
        cause: 'scarletLink',
        isMutual: false,
        bypassSurvival: true,
      },
      {
        kind: 'link',
        source: 1,
        from: 2,
        to: 1,
        cause: 'coupleLink',
        isMutual: true,
      },
    ]);

    expect(result.deaths).toEqual([1, 2, 3]);
    expect(result.causes[2]).toContain('scarletLink');
    expect(result.causes[1]).toContain('coupleLink');
  });

  it('does not add mutual-link causes to a seat already dead', () => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'poison', source: 0, target: 2 },
      {
        kind: 'link',
        source: 3,
        from: 3,
        to: 2,
        cause: 'coupleLink',
        isMutual: true,
      },
    ]);

    expect(result.causes[2]).toEqual(['poison']);
    expect(result.trace).not.toContainEqual({
      kind: 'link',
      cause: 'coupleLink',
      from: 3,
      to: 2,
    });
  });

  it('reflects only declared attack causes and preserves all death causes', () => {
    const result = resolveDeathEffects([
      { kind: 'attack', cause: 'poison', source: 1, target: 2 },
      { kind: 'immune', seat: 2, against: ['poison'] },
      { kind: 'reflect', seat: 2, against: ['poison', 'checkDeath'] },
    ]);

    expect(result.deaths).toEqual([1]);
    expect(result.causes[1]).toEqual(['reflection']);
    expect(result.trace).toContainEqual({
      kind: 'reflection',
      source: 1,
      target: 2,
    });
  });
});
