import { formatCountdownSeconds } from '../formatCountdown';

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
