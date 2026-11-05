/**
 * formatCheckResultLabel — the one check-result naming rule shared by the
 * in-room reveal title and the night review report.
 */
import { formatCheckResultLabel } from '../NightReview.helpers';

describe('formatCheckResultLabel', () => {
  it('passes factionCheck labels through untouched', () => {
    expect(formatCheckResultLabel('狼人', 'factionCheck')).toBe('狼人');
    expect(formatCheckResultLabel('好人', 'factionCheck')).toBe('好人');
  });

  it('names roleName results through the role spec', () => {
    expect(formatCheckResultLabel('villager', 'roleName')).toBe('平民');
    expect(formatCheckResultLabel('witch', 'roleName')).toBe('女巫');
    expect(formatCheckResultLabel('seer', 'roleName')).toBe('预言家');
  });

  it('fails fast on a roleName result that is not a role id', () => {
    expect(() => formatCheckResultLabel('not-a-role', 'roleName')).toThrow(
      '[FAIL-FAST] Reveal result not-a-role is not a role id',
    );
  });
});
