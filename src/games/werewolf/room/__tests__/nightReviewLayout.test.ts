/**
 * Night review layout pins: the timeline spec's static copy (timeline
 * section title, kicker) and the shared medal sizes. There is no column
 * geometry to pin: the action area has no fixed columns, no portraits,
 * and no width arithmetic (the B1 failure class is structurally absent).
 */
import {
  NIGHT_REPORT_KICKER,
  NIGHT_REPORT_MEDAL_SIZES,
  NIGHT_REPORT_TIMELINE_TITLE,
} from '../nightReviewLayout';

describe('nightReviewLayout timeline spec', () => {
  it('pins the static timeline copy', () => {
    expect(NIGHT_REPORT_TIMELINE_TITLE).toBe('第一夜');
    expect(NIGHT_REPORT_KICKER).toBe('🌙 第一夜 · 夜报');
  });

  it('pins the shared medal sizes', () => {
    expect(NIGHT_REPORT_MEDAL_SIZES).toEqual({ large: 44, roster: 26 });
  });
});
