/**
 * Night review layout pins: the pictorial spec's static copy (day tab,
 * block headers, empty-day text) and the shared medal sizes. There is no
 * column geometry to pin: the action area has no fixed columns and no
 * width arithmetic (the B1 failure class is structurally absent).
 */
import {
  NIGHT_REPORT_DAY_BLOCK_TITLE,
  NIGHT_REPORT_DAY_EMPTY_TEXT,
  NIGHT_REPORT_DAY_TAB_LABEL,
  NIGHT_REPORT_KICKER,
  NIGHT_REPORT_MEDAL_SIZES,
  NIGHT_REPORT_NIGHT_BLOCK_TITLE,
} from '../nightReviewLayout';

describe('nightReviewLayout pictorial spec', () => {
  it('pins the static day tab and block copy', () => {
    expect(NIGHT_REPORT_DAY_TAB_LABEL).toBe('第一天');
    expect(NIGHT_REPORT_NIGHT_BLOCK_TITLE).toBe('第 1 夜');
    expect(NIGHT_REPORT_DAY_BLOCK_TITLE).toBe('第 1 天');
    expect(NIGHT_REPORT_DAY_EMPTY_TEXT).toBe('白天事件未包含在对局记录中');
    expect(NIGHT_REPORT_KICKER).toBe('🌙 第一夜 · 夜报');
  });

  it('pins the shared medal sizes', () => {
    expect(NIGHT_REPORT_MEDAL_SIZES).toEqual({ large: 44, medium: 28, small: 24, roster: 26 });
  });
});
