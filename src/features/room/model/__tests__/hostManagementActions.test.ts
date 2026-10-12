import {
  buildNextRoundAction,
  buildReturnLobbyAction,
  buildStartGameAction,
} from '../hostManagementActions';

describe('host management action builders', () => {
  it('builds the unified start action with the shared key and testID', () => {
    const onPress = jest.fn();
    const action = buildStartGameAction({ onPress });
    expect(action).toMatchObject({
      key: 'start-game',
      label: '开始游戏',
      icon: 'play-outline',
      variant: 'primary',
      testID: 'start-game-button',
      isEnabled: true,
    });
    if (action.isEnabled) action.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('supports a per-game start label without changing key or testID', () => {
    const action = buildStartGameAction({ onPress: () => undefined, label: '开始本轮' });
    expect(action).toMatchObject({
      key: 'start-game',
      label: '开始本轮',
      testID: 'start-game-button',
    });
  });

  it('carries onDisabledPress and the reason into the disabled variant', () => {
    const onDisabledPress = jest.fn();
    const action = buildStartGameAction({
      onPress: () => undefined,
      isEnabled: false,
      disabledReason: '座位尚未坐满',
      onDisabledPress,
      isLoading: true,
    });
    expect(action).toMatchObject({
      key: 'start-game',
      isEnabled: false,
      disabledReason: '座位尚未坐满',
      isLoading: true,
    });
    if (!action.isEnabled && action.onDisabledPress) action.onDisabledPress();
    expect(onDisabledPress).toHaveBeenCalledTimes(1);
  });

  it('defaults the disabled feedback to null', () => {
    const action = buildStartGameAction({ onPress: () => undefined, isEnabled: false });
    expect(action).toMatchObject({ isEnabled: false, disabledReason: null, onDisabledPress: null });
  });

  it('builds the terminal pair with unified keys and testIDs', () => {
    expect(buildNextRoundAction({ onPress: () => undefined })).toMatchObject({
      key: 'next-round',
      label: '再来一局',
      icon: 'play-forward-outline',
      variant: 'primary',
      testID: 'next-round-button',
      isEnabled: true,
    });
    expect(buildReturnLobbyAction({ onPress: () => undefined })).toMatchObject({
      key: 'return-lobby',
      label: '返回大厅',
      icon: 'return-down-back-outline',
      variant: 'secondary',
      testID: 'return-lobby-button',
      isEnabled: true,
    });
  });
});
