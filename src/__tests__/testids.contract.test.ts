import { TESTIDS } from '@/testids';

describe('testids.ts contract (stability)', () => {
  it('keeps seatTile testID unchanged', () => {
    expect(TESTIDS.seatTile(0)).toBe('seat-tile-0');
    expect(TESTIDS.seatTile(7)).toBe('seat-tile-7');
  });

  it('keeps bottom-card modal testIDs unchanged', () => {
    expect(TESTIDS.chooseBottomCardModal).toBe('choose-bottom-card-modal');
    expect(TESTIDS.chooseBottomCardOption(0)).toBe('choose-bottom-card-option-0');
    expect(TESTIDS.chooseBottomCardOption(2)).toBe('choose-bottom-card-option-2');
  });

  it('new readiness gates are stable non-empty strings', () => {
    const stableIds: Array<[string, string]> = [
      ['homeScreenRoot', TESTIDS.homeScreenRoot],
      ['homeEnterRoomButton', TESTIDS.homeEnterRoomButton],
      ['homeCreateRoomButton', TESTIDS.homeCreateRoomButton],
      ['configScreenRoot', TESTIDS.configScreenRoot],
      ['configPresetSection', TESTIDS.configPresetSection],
      ['roomScreenRoot', TESTIDS.roomScreenRoot],
      ['roomHeader', TESTIDS.roomHeader],
      ['connectionStatusContainer', TESTIDS.connectionStatusContainer],
    ];

    for (const [, value] of stableIds) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      expect(value).toBe(value.trim());
      // Guardrail: should not contain whitespace
      expect(/\s/.test(value)).toBe(false);
    }
  });
});
