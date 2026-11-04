/**
 * Night review fixed-column geometry pins.
 *
 * The subject column must fit the medium medal, its gap, and the longest
 * role display name; the verb column must fit the longest verb. Both are
 * asserted against the live registries/literals so a longer name or verb
 * fails here first. The verb list mirrors the VerbText literals in
 * NightReviewReportBody (jest has no layout engine, so new verbs must be
 * added to the mirror by the author — the comment on the list says so).
 */
import { getRoleDisplayName, ROLE_SPECS } from '@game-judge/game-engine/games/werewolf/public';

import { spacing, typography } from '@/theme';

import {
  NIGHT_REPORT_MEDAL_SIZES,
  NIGHT_REPORT_SUBJECT_COLUMN_WIDTH,
  NIGHT_REPORT_VERB_COLUMN_WIDTH,
} from '../nightReviewLayout';

/** Every VerbText literal in NightReviewReportBody; extend when adding one. */
const VERB_LITERALS = [
  '封锁',
  '庇护',
  '守护',
  '禁言',
  '禁票',
  '诅咒',
  '摄梦',
  '交换',
  '连线',
  '选择了',
  '选择榜样',
  '模仿',
  '魅惑',
  '转化',
  '表白',
  '催眠',
  '查验',
  '学习',
  '感染',
  '使用解药救了',
  '毒杀',
];

describe('nightReviewLayout columns', () => {
  it('sizes the subject column for the longest role display name', () => {
    const longestRoleName = Math.max(
      ...Object.keys(ROLE_SPECS).map((roleId) => getRoleDisplayName(roleId).length),
    );
    expect(NIGHT_REPORT_SUBJECT_COLUMN_WIDTH).toBeGreaterThanOrEqual(
      NIGHT_REPORT_MEDAL_SIZES.medium +
        (spacing.tight + spacing.micro) +
        longestRoleName * typography.secondary,
    );
  });

  it('sizes the verb column for the longest verb literal', () => {
    const longestVerb = Math.max(...VERB_LITERALS.map((verb) => verb.length));
    expect(longestVerb).toBe(6);
    expect(NIGHT_REPORT_VERB_COLUMN_WIDTH).toBeGreaterThanOrEqual(
      longestVerb * typography.secondary,
    );
  });
});
