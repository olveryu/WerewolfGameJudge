import { describe, expect, it } from 'vitest';

import { getBotDisplayName } from '../getBotDisplayName';

describe('getBotDisplayName', () => {
  it('formats bot seats as 机器人N号 with the 1-based seat number', () => {
    expect(getBotDisplayName(0)).toBe('机器人1号');
    expect(getBotDisplayName(2)).toBe('机器人3号');
    expect(getBotDisplayName(11)).toBe('机器人12号');
  });
});
