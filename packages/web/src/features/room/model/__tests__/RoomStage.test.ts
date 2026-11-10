/** Stage model: roster grouping shared by the roster chip and sheet, and the stage shell guard. */
import { seatSource, seatViewModel } from '@/test-utils/roomSeat';

import type { RoomBottomStackModel } from '../RoomBottomActions';
import {
  assertRoomStageShellModel,
  countRoomStageRoster,
  groupRoomStageRoster,
} from '../RoomStage';

const EMPTY_STACK: RoomBottomStackModel = {
  kind: 'stacked',
  message: null,
  progress: null,
  layout: { primary: [], secondary: [], ghost: [] },
};

describe('groupRoomStageRoster', () => {
  it('splits occupied seats into acting, pending and done in seat order', () => {
    const groups = groupRoomStageRoster(
      seatSource([
        seatViewModel(0, { statusBadge: { label: '已完成', tone: 'success' } }),
        seatViewModel(1, { player: null }),
        seatViewModel(2, { isBot: true, isSelf: false }),
        seatViewModel(3, { isSelf: true, statusBadge: { label: '上传中', tone: 'info' } }),
        seatViewModel(4, { statusBadge: { label: '已完成', tone: 'success' } }),
      ]),
      { actingSeat: null, pendingLabel: '作答中' },
    );

    expect(groups.acting).toEqual([]);
    expect(
      groups.pending.map((entry) => [entry.seat, entry.statusLabel, entry.statusTone]),
    ).toEqual([
      [2, '作答中', 'muted'],
      [3, '上传中', 'info'],
    ]);
    expect(groups.pending[0]).toMatchObject({ isBot: true, isSelf: false, displayName: '玩家3' });
    expect(groups.pending[1]).toMatchObject({ isBot: false, isSelf: true });
    expect(groups.done.map((entry) => entry.seat)).toEqual([0, 4]);
    expect(countRoomStageRoster(groups)).toEqual({ done: 2, total: 4 });
  });

  it('puts the acting seat first even when it carries a success badge', () => {
    const groups = groupRoomStageRoster(
      seatSource([
        seatViewModel(0, { statusBadge: { label: '已猜中', tone: 'success' } }),
        seatViewModel(1, { statusBadge: { label: '画手中', tone: 'warning' } }),
      ]),
      { actingSeat: 1, pendingLabel: '猜词中' },
    );

    expect(groups.acting.map((entry) => [entry.seat, entry.statusLabel])).toEqual([[1, '画手中']]);
    expect(groups.done.map((entry) => entry.seat)).toEqual([0]);
    expect(groups.pending).toEqual([]);
  });

  it('fails fast when the acting seat is empty', () => {
    expect(() =>
      groupRoomStageRoster(seatSource([seatViewModel(0), seatViewModel(1, { player: null })]), {
        actingSeat: 1,
        pendingLabel: '猜词中',
      }),
    ).toThrow('Stage roster acting seat 1 is not occupied');
  });
});

describe('assertRoomStageShellModel', () => {
  const valid = { bottomActions: EMPTY_STACK, isAudioPlaying: false, hostManagement: null };

  it('accepts an empty bottom model with host management that has no task', () => {
    expect(() => assertRoomStageShellModel(valid)).not.toThrow();
    expect(() =>
      assertRoomStageShellModel({ ...valid, hostManagement: { task: null, sections: [] } }),
    ).not.toThrow();
  });

  it('rejects bottom messages, progress and buttons', () => {
    expect(() =>
      assertRoomStageShellModel({ ...valid, bottomActions: { ...EMPTY_STACK, message: '等待' } }),
    ).toThrow('Stage content cannot carry bottom actions');
    expect(() =>
      assertRoomStageShellModel({
        ...valid,
        bottomActions: { ...EMPTY_STACK, progress: { current: 1, total: 3, label: '' } },
      }),
    ).toThrow('Stage content cannot carry bottom actions');
    expect(() =>
      assertRoomStageShellModel({
        ...valid,
        bottomActions: {
          kind: 'dock',
          message: null,
          progress: null,
          leading: null,
          trailing: null,
          primary: {
            key: 'ready',
            label: '准备',
            audience: 'participant',
            variant: 'primary',
            size: 'md',
            isEnabled: false,
            disabledReason: null,
          },
        },
      }),
    ).toThrow('Stage content cannot carry bottom actions');
  });

  it('rejects narration audio and a host task card', () => {
    expect(() => assertRoomStageShellModel({ ...valid, isAudioPlaying: true })).toThrow(
      'Stage content cannot play narration audio',
    );
    expect(() =>
      assertRoomStageShellModel({
        ...valid,
        hostManagement: { task: { kind: 'message', text: '等待' }, sections: [] },
      }),
    ).toThrow('Stage content cannot carry a host task card');
  });
});
