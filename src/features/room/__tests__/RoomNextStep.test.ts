import { buildStartGameAction } from '@/features/room/model/hostManagementActions';
import type { RoomCapability } from '@/features/room/model/RoomCapabilities';
import {
  buildRoomNextStep,
  buildShareRoomRemedy,
  type RoomNextStepRemedy,
} from '@/features/room/model/RoomHostManagement';

const shareRemedy: RoomNextStepRemedy = { label: '分享房间', onPress: jest.fn() };

describe('buildRoomNextStep', () => {
  it('passes an enabled action through as ready with the same press callback', () => {
    const onPress = jest.fn();
    const action = buildStartGameAction({ label: '开始游戏', onPress, isEnabled: true });
    const step = buildRoomNextStep({ action, remedy: shareRemedy });
    expect(step).toMatchObject({ actionKey: 'start-game', label: '开始游戏' });
    if (step?.state.kind !== 'ready') throw new Error('expected a ready next step');
    expect(step.state.onPress).toBe(onPress);
  });

  it('lets the caller gate the ready press (e.g. with a confirm) without touching the action', () => {
    const action = buildStartGameAction({ onPress: jest.fn(), isEnabled: true });
    const gatedPress = jest.fn();
    const step = buildRoomNextStep({ action, onPress: gatedPress });
    if (step?.state.kind !== 'ready') throw new Error('expected a ready next step');
    expect(step.state.onPress).toBe(gatedPress);
  });

  it('turns a disabled action with a reason into a blocked step carrying reason and remedy', () => {
    const action = buildStartGameAction({
      label: '分配角色',
      onPress: jest.fn(),
      isEnabled: false,
      disabledReason: '座位尚未坐满',
    });
    const step = buildRoomNextStep({ action, remedy: shareRemedy });
    expect(step).toMatchObject({ actionKey: 'start-game', label: '分配角色' });
    if (step?.state.kind !== 'blocked') throw new Error('expected a blocked next step');
    expect(step.state.reason).toBe('座位尚未坐满');
    expect(step.state.remedy).toBe(shareRemedy);
  });

  it('prefers the caller-supplied blocked reason over the action reason', () => {
    const action = buildStartGameAction({
      onPress: jest.fn(),
      isEnabled: false,
      disabledReason: '请先坐满所有座位。',
    });
    const step = buildRoomNextStep({ action, blockedReason: '座位尚未坐满（还差 2 人）' });
    if (step?.state.kind !== 'blocked') throw new Error('expected a blocked next step');
    expect(step.state.reason).toBe('座位尚未坐满（还差 2 人）');
    expect(step.state.remedy).toBeNull();
  });

  it('yields no step while an action is disabled without a reason (e.g. submitting)', () => {
    const action = buildStartGameAction({
      onPress: jest.fn(),
      isEnabled: false,
      disabledReason: null,
    });
    expect(buildRoomNextStep({ action, remedy: shareRemedy })).toBeNull();
  });
});

describe('buildShareRoomRemedy', () => {
  it('wraps an allowed share capability, reusing its execute callback', () => {
    const execute = jest.fn();
    const capability: RoomCapability = { isAllowed: true, execute };
    const remedy = buildShareRoomRemedy(capability);
    expect(remedy?.label).toBe('分享房间');
    expect(remedy?.onPress).toBe(execute);
  });

  it('yields no remedy when sharing is not allowed', () => {
    const capability: RoomCapability = { isAllowed: false, reason: '不可分享' };
    expect(buildShareRoomRemedy(capability)).toBeNull();
  });
});
