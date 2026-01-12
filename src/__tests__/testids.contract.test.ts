import { TESTIDS } from '../testids';

describe('testids.ts contract (stability + legacy compatibility)', () => {
  it('keeps legacy seatTile testID unchanged', () => {
    expect(TESTIDS.seatTile(0)).toBe('seat-tile-0');
    expect(TESTIDS.seatTile(7)).toBe('seat-tile-7');
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
      ['forceSyncButton', TESTIDS.forceSyncButton],
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
