/** Account settlement notifications shared by all games; strictly decoded at the inbox boundary. */

export interface AccountSettlementEvent {
  readonly type: 'SETTLE_RESULT';
  readonly eventId: string;
  readonly gameType: 'werewolf' | 'fibking' | 'pictionary';
  readonly settlementId: string;
  readonly endedRevision: number;
  readonly xpEarned: number;
  readonly newXp: number;
  readonly newLevel: number;
  readonly previousLevel: number;
  readonly normalDrawsEarned: number;
  readonly goldenDrawsEarned: number;
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

function requireNonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, fieldName: string): number {
  const parsed = requireNonNegativeInteger(value, fieldName);
  if (parsed === 0) throw new Error(`${fieldName} must be positive`);
  return parsed;
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value;
}

export function parseAccountEvent(value: unknown): AccountSettlementEvent {
  if (!isRecord(value)) throw new Error('Account event must be an object');
  const expectedKeys = [
    'type',
    'eventId',
    'gameType',
    'settlementId',
    'endedRevision',
    'xpEarned',
    'newXp',
    'newLevel',
    'previousLevel',
    'normalDrawsEarned',
    'goldenDrawsEarned',
  ];
  const actualKeys = Object.keys(value);
  const unknownKey = actualKeys.find((key) => !expectedKeys.includes(key));
  if (unknownKey !== undefined) {
    throw new Error(`SETTLE_RESULT contains unknown field: ${unknownKey}`);
  }
  const missingKey = expectedKeys.find((key) => !actualKeys.includes(key));
  if (missingKey !== undefined) {
    throw new Error(`SETTLE_RESULT is missing field: ${missingKey}`);
  }
  if (value.type !== 'SETTLE_RESULT') {
    throw new Error(`Unsupported account event type: ${String(value.type)}`);
  }
  if (
    value.gameType !== 'werewolf' &&
    value.gameType !== 'fibking' &&
    value.gameType !== 'pictionary'
  ) {
    throw new Error(`SETTLE_RESULT gameType is invalid: ${String(value.gameType)}`);
  }
  return {
    type: value.type,
    eventId: requireNonEmptyString(value.eventId, 'SETTLE_RESULT.eventId'),
    gameType: value.gameType,
    settlementId: requireNonEmptyString(value.settlementId, 'SETTLE_RESULT.settlementId'),
    endedRevision: requirePositiveInteger(value.endedRevision, 'SETTLE_RESULT.endedRevision'),
    xpEarned: requireNonNegativeInteger(value.xpEarned, 'SETTLE_RESULT.xpEarned'),
    newXp: requireNonNegativeInteger(value.newXp, 'SETTLE_RESULT.newXp'),
    newLevel: requireNonNegativeInteger(value.newLevel, 'SETTLE_RESULT.newLevel'),
    previousLevel: requireNonNegativeInteger(value.previousLevel, 'SETTLE_RESULT.previousLevel'),
    normalDrawsEarned: requireNonNegativeInteger(
      value.normalDrawsEarned,
      'SETTLE_RESULT.normalDrawsEarned',
    ),
    goldenDrawsEarned: requireNonNegativeInteger(
      value.goldenDrawsEarned,
      'SETTLE_RESULT.goldenDrawsEarned',
    ),
  };
}
