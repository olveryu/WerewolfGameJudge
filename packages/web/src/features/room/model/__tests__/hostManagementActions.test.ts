import {
  buildAssignRolesAction,
  buildEnabledHostAction,
  buildPendingAwareHostAction,
  buildResetToLobbyAction,
  buildStartGameAction,
  createViewingBeginGate,
  HOST_ACTION_KEYS,
  hostActionTask,
  hostMessageTask,
  projectViewingProgress,
  type RoomHostActionDescriptor,
} from '../hostManagementActions';

describe('host management action builders', () => {
  it('builds the unified start action with the shared key and testID', () => {
    const onPress = vi.fn();
    const action = buildStartGameAction({ onPress });
    expect(action).toMatchObject({
      key: 'start-game',
      label: '开始游戏',
      icon: 'play-outline',
      category: 'host',
      testID: 'start-game-button',
      state: { kind: 'ready' },
    });
    if (action.state.kind === 'ready') action.state.onPress();
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

  it('marks reset-to-lobby as the explicit stage-menu abort action', () => {
    expect(buildResetToLobbyAction({ onPress: () => undefined })).toMatchObject({
      key: 'restart',
      category: 'danger',
      stageMenuRole: 'abort',
    });
  });

  it('carries the reason into the blocked state', () => {
    const action = buildStartGameAction({
      onPress: () => undefined,
      isEnabled: false,
      disabledReason: '座位尚未坐满',
    });
    expect(action).toMatchObject({
      key: 'start-game',
      state: { kind: 'blocked', reason: '座位尚未坐满' },
    });
    expect(action.state).not.toHaveProperty('onPress');
  });

  it('defaults the disabled reason to null', () => {
    const action = buildStartGameAction({ onPress: () => undefined, isEnabled: false });
    expect(action.state).toEqual({ kind: 'blocked', reason: null });
  });

  it('builds host tasks that reference sheet actions by key only', () => {
    expect(hostActionTask(HOST_ACTION_KEYS.startGame)).toEqual({
      kind: 'action',
      actionKey: 'start-game',
    });
    expect(hostMessageTask('等待', { escapeActionKey: 'mark-bots-viewed' })).toEqual({
      kind: 'message',
      text: '等待',
      escapeActionKey: 'mark-bots-viewed',
    });
    expect(hostActionTask('x', { note: 'n' })).toEqual({
      kind: 'action',
      actionKey: 'x',
      note: 'n',
    });
  });
});

describe('host action pending marshal', () => {
  const descriptor: RoomHostActionDescriptor = {
    key: 'sample-action',
    label: '示例操作',
    icon: 'checkmark-done-outline',
    category: 'host',
    testID: 'sample-action-button',
  };

  it('binds the press handler when not pending', () => {
    const onPress = vi.fn();
    const action = buildPendingAwareHostAction(descriptor, false, onPress);
    expect(action).toMatchObject({ ...descriptor, state: { kind: 'ready' } });
    if (action.state.kind === 'ready') action.state.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('drops the press handler and nulls the reason while pending', () => {
    const action = buildPendingAwareHostAction(descriptor, true, () => undefined);
    expect(action).toMatchObject({
      ...descriptor,
      state: { kind: 'blocked', reason: null },
    });
    expect(action.state).not.toHaveProperty('onPress');
  });

  it('builds an enabled action from a descriptor without a loading declaration', () => {
    const onPress = vi.fn();
    const action = buildEnabledHostAction(
      {
        key: 'night-review',
        label: '本局复盘',
        icon: 'document-text-outline',
        category: 'resource',
      },
      onPress,
    );
    expect(action).toMatchObject({ key: 'night-review', state: { kind: 'ready' } });
    if (action.state.kind === 'ready') action.state.onPress();
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
