type OverrideKey = 'completion' | 'isSeatSettled';

interface StepOverrideDefinition {
  readonly id: string;
  readonly completion?: unknown;
  readonly isSeatSettled?: unknown;
}

export function getStepOverrideViolations(
  definitions: readonly StepOverrideDefinition[],
  allowlist: Readonly<Record<string, readonly OverrideKey[]>>,
): readonly string[] {
  const violations: string[] = [];
  const registeredIds = new Set<string>();
  for (const definition of definitions) {
    registeredIds.add(definition.id);
    const actual: OverrideKey[] = [];
    if (definition.completion !== undefined) actual.push('completion');
    if (definition.isSeatSettled !== undefined) actual.push('isSeatSettled');
    const approved = allowlist[definition.id] ?? [];
    for (const key of actual) {
      if (!approved.includes(key)) violations.push(`${definition.id}.${key} is not allowlisted`);
    }
    for (const key of approved) {
      if (!actual.includes(key))
        violations.push(`${definition.id}.${key} is allowlisted but unused`);
    }
  }
  for (const stepId of Object.keys(allowlist)) {
    if (!registeredIds.has(stepId))
      violations.push(`${stepId} has an unused override allowlist entry`);
  }
  return violations;
}
