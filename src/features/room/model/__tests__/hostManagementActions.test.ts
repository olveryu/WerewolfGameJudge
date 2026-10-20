import {
  buildAbortGameAction,
  buildAssignRolesAction,
  buildEnabledHostAction,
  buildNextRoundAction,
  buildPendingAwareHostAction,
  buildRestartGameAction,
  buildReturnLobbyAction,
  buildStartGameAction,
  createViewingBeginGate,
  projectViewingProgress,
  type RoomHostActionDescriptor,
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

  it('builds the chassis assign action with the fixed vocabulary', () => {
    const action = buildAssignRolesAction({ onPress: () => undefined });
    expect(action).toMatchObject({
      key: 'assign-roles',
      label: '分配角色',
      testID: 'assign-roles-button',
    });
  });

  it('builds the chassis abort and restart actions with the fixed vocabulary', () => {
    expect(buildAbortGameAction({ onPress: () => undefined })).toMatchObject({
      key: 'abort-game',
      label: '中止本局',
      variant: 'danger',
      testID: 'abort-game-button',
    });
    expect(buildRestartGameAction({ onPress: () => undefined })).toMatchObject({
      key: 'restart',
      label: '重新开始',
      variant: 'secondary',
      testID: 'restart-button',
    });
  });

  it('carries the reason into the disabled variant', () => {
    const action = buildStartGameAction({
      onPress: () => undefined,
      isEnabled: false,
      disabledReason: '座位尚未坐满',
      isLoading: true,
    });
    expect(action).toMatchObject({
      key: 'start-game',
      isEnabled: false,
      disabledReason: '座位尚未坐满',
      isLoading: true,
    });
    expect(action).not.toHaveProperty('onPress');
  });

  it('defaults the disabled reason to null', () => {
    const action = buildStartGameAction({ onPress: () => undefined, isEnabled: false });
    expect(action).toMatchObject({ isEnabled: false, disabledReason: null });
  });

  it('carries the primary and remedy fields into the built action', () => {
    const remedy = { label: '分享房间', onPress: jest.fn() };
    const action = buildStartGameAction({
      onPress: () => undefined,
      isEnabled: false,
      disabledReason: '座位尚未坐满',
      isPrimary: true,
      remedy,
    });
    expect(action).toMatchObject({ isPrimary: true, remedy });
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

describe('host action pending marshal', () => {
  const descriptor: RoomHostActionDescriptor = {
    key: 'finish-vote',
    label: '结束投票',
    icon: 'checkmark-done-outline',
    variant: 'primary',
    testID: 'finish-vote-button',
    isLoading: true,
  };

  it('binds the press handler when not pending', () => {
    const onPress = jest.fn();
    const action = buildPendingAwareHostAction(descriptor, false, onPress);
    expect(action).toMatchObject({ ...descriptor, isEnabled: true });
    if (action.isEnabled) action.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('drops the press handler and nulls the reason while pending', () => {
    const action = buildPendingAwareHostAction(descriptor, true, () => undefined);
    expect(action).toMatchObject({
      ...descriptor,
      isEnabled: false,
      disabledReason: null,
    });
    expect(action).not.toHaveProperty('onPress');
  });

  it('builds an enabled action from a descriptor without a loading declaration', () => {
    const onPress = jest.fn();
    const action = buildEnabledHostAction(
      {
        key: 'night-review',
        label: '本局复盘',
        icon: 'document-text-outline',
        variant: 'secondary',
      },
      onPress,
    );
    expect(action).toMatchObject({ key: 'night-review', isEnabled: true });
    if (action.isEnabled) action.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('viewing begin gate', () => {
  it('projects counts from the participant set, ignoring records outside it', () => {
    expect(projectViewingProgress([{ seat: 0 }, { seat: 1 }, { seat: 2 }], [0, 2, 7])).toEqual({
      viewedCount: 2,
      totalSeats: 3,
    });
  });

  it('opens only when every participant has viewed', () => {
    expect(
      createViewingBeginGate({
        viewedCount: 3,
        totalSeats: 3,
        submitting: false,
        notViewedCopy: '还有玩家未查看',
      }),
    ).toEqual({ allViewed: true, isEnabled: true, disabledReason: null });
    expect(
      createViewingBeginGate({
        viewedCount: 2,
        totalSeats: 3,
        submitting: false,
        notViewedCopy: '还有玩家未查看',
      }),
    ).toEqual({ allViewed: false, isEnabled: false, disabledReason: '还有玩家未查看' });
  });

  it('stays closed while submitting even when everyone has viewed', () => {
    expect(
      createViewingBeginGate({
        viewedCount: 3,
        totalSeats: 3,
        submitting: true,
        notViewedCopy: '还有玩家未查看',
      }),
    ).toEqual({ allViewed: true, isEnabled: false, disabledReason: null });
  });

  it('never opens for an empty participant set', () => {
    expect(
      createViewingBeginGate({
        viewedCount: 0,
        totalSeats: 0,
        submitting: false,
        notViewedCopy: '还有玩家未查看',
      }),
    ).toEqual({ allViewed: false, isEnabled: false, disabledReason: '还有玩家未查看' });
  });
});
