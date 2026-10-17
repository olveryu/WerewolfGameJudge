import { resolveHostConsolePrimary } from '../resolveHostConsolePrimary';
import type { RoomHostManagementAction, RoomHostManagementModel } from '../RoomHostManagement';

function modelWith(actions: RoomHostManagementAction[]): RoomHostManagementModel {
  return { sections: [{ key: 'game', title: '游戏', actions }] };
}

const enabledStart: RoomHostManagementAction = {
  key: 'start-game',
  label: '开始游戏',
  icon: 'play-outline',
  variant: 'primary',
  isEnabled: true,
  onPress: () => undefined,
};

describe('resolveHostConsolePrimary', () => {
  it('returns null when no action is marked primary', () => {
    expect(resolveHostConsolePrimary(modelWith([enabledStart]))).toBeNull();
    expect(resolveHostConsolePrimary({ sections: [] })).toBeNull();
  });

  it('resolves an enabled primary as ready through its own press', () => {
    const onPress = jest.fn();
    const primary = resolveHostConsolePrimary(
      modelWith([{ ...enabledStart, onPress, isPrimary: true }]),
    );
    expect(primary).toMatchObject({ kind: 'ready', actionKey: 'start-game', label: '开始游戏' });
    if (primary?.kind === 'ready') primary.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('resolves a disabled primary with a reason as blocked with its remedy', () => {
    const remedy = { label: '分享房间', onPress: jest.fn() };
    const primary = resolveHostConsolePrimary(
      modelWith([
        {
          key: 'start-game',
          label: '开始游戏',
          icon: 'play-outline',
          variant: 'primary',
          isEnabled: false,
          disabledReason: '座位尚未坐满（还差 2 人）',
          isPrimary: true,
          remedy,
        },
      ]),
    );
    expect(primary).toEqual({
      kind: 'blocked',
      actionKey: 'start-game',
      label: '开始游戏',
      reason: '座位尚未坐满（还差 2 人）',
      remedy,
    });
  });

  it('resolves a console-only blocked reason while the action stays enabled', () => {
    const remedy = { label: '分享房间', onPress: jest.fn() };
    const primary = resolveHostConsolePrimary(
      modelWith([
        {
          ...enabledStart,
          isPrimary: true,
          consoleBlockedReason: '还有 2 个空位等待入座',
          remedy,
        },
      ]),
    );
    expect(primary).toEqual({
      kind: 'blocked',
      actionKey: 'start-game',
      label: '开始游戏',
      reason: '还有 2 个空位等待入座',
      remedy,
    });
  });

  it('returns null for a disabled primary without a reason (transient submission lock)', () => {
    const primary = resolveHostConsolePrimary(
      modelWith([
        {
          key: 'start-game',
          label: '开始游戏',
          icon: 'play-outline',
          variant: 'primary',
          isEnabled: false,
          disabledReason: null,
          isPrimary: true,
        },
      ]),
    );
    expect(primary).toBeNull();
  });

  it('finds the primary across sections and fails fast on two primaries', () => {
    const across = resolveHostConsolePrimary({
      sections: [
        { key: 'room', title: '房间管理', actions: [] },
        { key: 'game', title: '游戏', actions: [{ ...enabledStart, isPrimary: true }] },
      ],
    });
    expect(across).toMatchObject({ kind: 'ready', actionKey: 'start-game' });

    expect(() =>
      resolveHostConsolePrimary(
        modelWith([
          { ...enabledStart, isPrimary: true },
          { ...enabledStart, key: 'begin-game', isPrimary: true },
        ]),
      ),
    ).toThrow('at most one is allowed');
  });
});
