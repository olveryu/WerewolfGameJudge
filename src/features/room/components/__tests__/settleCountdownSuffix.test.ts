/**
 * getSettleCountdownSuffix: the single top-surface countdown
 * implementation — ticking suffix while seconds remain, the game's
 * settled suffix at 0/null, never a literal 0.
 */
import {
  getSettleCountdownSuffix,
  type SettleCountdownWording,
} from '@/features/room/components/settleCountdownSuffix';

const SHERIFF_WORDING: SettleCountdownWording = {
  tickingVerb: '自动公布结果',
  settledSuffix: '，即将自动公布结果',
};

const AVALON_WORDING: SettleCountdownWording = {
  tickingVerb: '揭晓',
  settledSuffix: '',
};

describe('getSettleCountdownSuffix', () => {
  it('shows the ticking countdown while seconds remain', () => {
    expect(getSettleCountdownSuffix(5, SHERIFF_WORDING)).toBe('，5秒后自动公布结果');
    expect(getSettleCountdownSuffix(1, SHERIFF_WORDING)).toBe('，1秒后自动公布结果');
    expect(getSettleCountdownSuffix(5, AVALON_WORDING)).toBe('，5秒后揭晓');
    expect(getSettleCountdownSuffix(1, AVALON_WORDING)).toBe('，1秒后揭晓');
  });

  it('falls back to the game settled suffix at 0 and null, never a literal 0', () => {
    expect(getSettleCountdownSuffix(0, SHERIFF_WORDING)).toBe('，即将自动公布结果');
    expect(getSettleCountdownSuffix(null, SHERIFF_WORDING)).toBe('，即将自动公布结果');
    expect(getSettleCountdownSuffix(0, AVALON_WORDING)).toBe('');
    expect(getSettleCountdownSuffix(null, AVALON_WORDING)).toBe('');
  });
});
