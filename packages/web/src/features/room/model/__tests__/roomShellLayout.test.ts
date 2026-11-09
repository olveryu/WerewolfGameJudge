import type { RoomHeaderMeasurements } from '@/features/room/model/roomShellLayout';
import {
  resolveRoomHeaderLayout,
  ROOM_SIDE_INSPECTOR_MIN_WIDTH,
  usesRoomSideInspector,
} from '@/features/room/model/roomShellLayout';

const BASE_HEADER_MEASUREMENTS: RoomHeaderMeasurements = {
  centerContentWidth: 170,
  horizontalPaddingWidth: 50,
  leadingWidth: 50,
  trailingWidth: 50,
};
const ASYMMETRIC_HEADER_MEASUREMENTS: RoomHeaderMeasurements = {
  ...BASE_HEADER_MEASUREMENTS,
  trailingWidth: 110,
};
const BALANCED_HEADER_MEASUREMENTS: RoomHeaderMeasurements = {
  ...BASE_HEADER_MEASUREMENTS,
  leadingWidth: 110,
  trailingWidth: 110,
};

describe('roomShellLayout', () => {
  it('uses the compact layout below the inspector breakpoint', () => {
    expect(usesRoomSideInspector(ROOM_SIDE_INSPECTOR_MIN_WIDTH - 1)).toBe(false);
  });

  it('uses the side inspector at and above the breakpoint', () => {
    expect(usesRoomSideInspector(ROOM_SIDE_INSPECTOR_MIN_WIDTH)).toBe(true);
    expect(usesRoomSideInspector(1440)).toBe(true);
  });

  it('uses remaining header space before stacking asymmetric controls', () => {
    expect(resolveRoomHeaderLayout(379, ASYMMETRIC_HEADER_MEASUREMENTS)).toBe('stacked');
    expect(resolveRoomHeaderLayout(380, ASYMMETRIC_HEADER_MEASUREMENTS)).toBe('compact');
    expect(resolveRoomHeaderLayout(390, ASYMMETRIC_HEADER_MEASUREMENTS)).toBe('compact');
    expect(resolveRoomHeaderLayout(439, ASYMMETRIC_HEADER_MEASUREMENTS)).toBe('compact');
    expect(resolveRoomHeaderLayout(440, ASYMMETRIC_HEADER_MEASUREMENTS)).toBe('centered');
  });

  it('increases the single-row width for every extra action', () => {
    expect(resolveRoomHeaderLayout(319, BASE_HEADER_MEASUREMENTS)).toBe('stacked');
    expect(resolveRoomHeaderLayout(320, BASE_HEADER_MEASUREMENTS)).toBe('centered');
    expect(resolveRoomHeaderLayout(439, BALANCED_HEADER_MEASUREMENTS)).toBe('stacked');
    expect(resolveRoomHeaderLayout(440, BALANCED_HEADER_MEASUREMENTS)).toBe('centered');
  });

  it('rejects invalid viewport widths and measurements', () => {
    expect(() => usesRoomSideInspector(0)).toThrow('Room viewport width must be positive');
    expect(() => resolveRoomHeaderLayout(Number.NaN, BASE_HEADER_MEASUREMENTS)).toThrow(
      'Room viewport width must be positive',
    );
    expect(() =>
      resolveRoomHeaderLayout(390, {
        ...BASE_HEADER_MEASUREMENTS,
        leadingWidth: -1,
      }),
    ).toThrow('Room header measurement must be non-negative and finite');
  });
});
