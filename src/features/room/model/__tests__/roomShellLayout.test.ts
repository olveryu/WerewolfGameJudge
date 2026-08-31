import {
  ROOM_SIDE_INSPECTOR_MIN_WIDTH,
  ROOM_SINGLE_ROW_HEADER_MIN_WIDTH,
  usesRoomSideInspector,
  usesStackedRoomHeader,
} from '@/features/room/model/roomShellLayout';

describe('roomShellLayout', () => {
  it('uses the compact layout below the inspector breakpoint', () => {
    expect(usesRoomSideInspector(ROOM_SIDE_INSPECTOR_MIN_WIDTH - 1)).toBe(false);
  });

  it('uses the side inspector at and above the breakpoint', () => {
    expect(usesRoomSideInspector(ROOM_SIDE_INSPECTOR_MIN_WIDTH)).toBe(true);
    expect(usesRoomSideInspector(1440)).toBe(true);
  });

  it('stacks header controls only below the single-row breakpoint', () => {
    expect(usesStackedRoomHeader(ROOM_SINGLE_ROW_HEADER_MIN_WIDTH - 1)).toBe(true);
    expect(usesStackedRoomHeader(ROOM_SINGLE_ROW_HEADER_MIN_WIDTH)).toBe(false);
  });

  it('rejects invalid viewport widths', () => {
    expect(() => usesRoomSideInspector(0)).toThrow('Room viewport width must be positive');
    expect(() => usesStackedRoomHeader(Number.NaN)).toThrow('Room viewport width must be positive');
  });
});
