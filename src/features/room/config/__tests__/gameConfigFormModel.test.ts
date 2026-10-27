import type { GameConfigSchema } from '@game-judge/game-engine/platform/config/configSchema';

import {
  describeDefaultSummary,
  parseCountDraft,
  readFieldValue,
  resolveConfigIssue,
  toConfigRecord,
  withFieldValue,
} from '../gameConfigFormModel';

interface SampleConfig {
  readonly numberOfPlayers: number;
  readonly hasBlank: boolean;
  readonly timer: 30 | null;
}

const SCHEMA: GameConfigSchema<SampleConfig> = {
  fields: {
    numberOfPlayers: { kind: 'count', label: '玩家人数', min: 4, max: 12 },
    hasBlank: { kind: 'toggle', label: '白板' },
    timer: { kind: 'duration', label: '计时', values: [30, null] },
  },
  defaults: { numberOfPlayers: 6, hasBlank: false, timer: 30 },
  validate: (config) =>
    config.hasBlank && config.numberOfPlayers < 6
      ? { field: 'hasBlank', message: '启用白板至少需要 6 人' }
      : null,
};

describe('parseCountDraft', () => {
  it.each([
    ['6', 6],
    ['12', 12],
    ['0', 0],
    ['', null],
    ['-1', null],
    ['6.5', null],
    ['abc', null],
  ])('%p → %p', (text, expected) => {
    expect(parseCountDraft(text)).toBe(expected);
  });
});

describe('withFieldValue / readFieldValue', () => {
  it('replaces one key and keeps the others', () => {
    const next = withFieldValue(SCHEMA.defaults, 'hasBlank', true);
    expect(next).toEqual({ numberOfPlayers: 6, hasBlank: true, timer: 30 });
    expect(readFieldValue(next, 'timer')).toBe(30);
    expect(readFieldValue(withFieldValue(next, 'timer', null), 'timer')).toBeNull();
  });
});

describe('resolveConfigIssue', () => {
  it('returns null for a valid config without drafts', () => {
    expect(resolveConfigIssue(SCHEMA, SCHEMA.defaults, {})).toBeNull();
  });

  it('reports an unparsable count draft on its field before schema validation', () => {
    expect(resolveConfigIssue(SCHEMA, SCHEMA.defaults, { numberOfPlayers: '' })).toEqual({
      field: 'numberOfPlayers',
      message: '玩家人数需为 4 至 12 的整数',
    });
  });

  it('ignores a parsable draft and falls through to schema validation', () => {
    expect(
      resolveConfigIssue(
        SCHEMA,
        { ...SCHEMA.defaults, numberOfPlayers: 13 },
        { numberOfPlayers: '13' },
      ),
    ).toEqual({ field: 'numberOfPlayers', message: '玩家人数需为 4 至 12 的整数' });
    expect(
      resolveConfigIssue(SCHEMA, { ...SCHEMA.defaults, numberOfPlayers: 5, hasBlank: true }, {}),
    ).toEqual({ field: 'hasBlank', message: '启用白板至少需要 6 人' });
  });
});

describe('summary and record helpers', () => {
  it('summarises numberOfPlayers when present', () => {
    expect(describeDefaultSummary(SCHEMA.defaults)).toBe('共 6 人');
    expect(describeDefaultSummary({ mode: 'public' })).toBeNull();
  });

  it('produces a plain record copy for transport', () => {
    const record = toConfigRecord(SCHEMA.defaults);
    expect(record).toEqual(SCHEMA.defaults);
    expect(record).not.toBe(SCHEMA.defaults);
  });
});
