import { formatCountdownSeconds, formatSettleCountdown } from '../formatCountdown';

describe('formatCountdownSeconds', () => {
  it('formats seconds under a minute', () => {
    expect(formatCountdownSeconds(9)).toBe('0:09');
    expect(formatCountdownSeconds(59)).toBe('0:59');
  });

  it('formats whole minutes', () => {
    expect(formatCountdownSeconds(60)).toBe('1:00');
    expect(formatCountdownSeconds(120)).toBe('2:00');
  });

  it('formats minutes and seconds', () => {
    expect(formatCountdownSeconds(75)).toBe('1:15');
    expect(formatCountdownSeconds(605)).toBe('10:05');
  });

  it('formats zero', () => {
    expect(formatCountdownSeconds(0)).toBe('0:00');
  });
});

describe('formatSettleCountdown', () => {
  it('shows the remaining seconds while the settle countdown runs', () => {
    expect(formatSettleCountdown(5, '投票')).toBe('已全部投票，5 秒后揭晓');
    expect(formatSettleCountdown(1, '出牌')).toBe('已全部出牌，1 秒后揭晓');
  });

  it('waits for the reveal when no countdown is left', () => {
    expect(formatSettleCountdown(0, '投票')).toBe('已全部投票，等待揭晓');
    expect(formatSettleCountdown(null, '出牌')).toBe('已全部出牌，等待揭晓');
  });
});
