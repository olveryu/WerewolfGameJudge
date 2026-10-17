import {
  buildEndedWaitingMessage,
  buildLobbyHostStartMessage,
  buildPreparationFailureMessage,
  buildStepActorWaitingMessage,
  buildViewIdentityButton,
  resolveViewIdentityAction,
  VIEW_IDENTITY_LABEL,
} from '../RoomBottomActions';

describe('buildLobbyHostStartMessage', () => {
  it('shows the hint to a seated non-host player in the lobby', () => {
    expect(buildLobbyHostStartMessage({ isLobby: true, isHost: false, mySeat: 2 })).toBe(
      '等待房主开始游戏',
    );
  });

  it('hides the hint from the host', () => {
    expect(buildLobbyHostStartMessage({ isLobby: true, isHost: true, mySeat: 0 })).toBeNull();
  });

  it('hides the hint from a lobby spectator without a seat', () => {
    expect(buildLobbyHostStartMessage({ isLobby: true, isHost: false, mySeat: null })).toBeNull();
  });

  it('hides the hint once the game has left the lobby', () => {
    expect(buildLobbyHostStartMessage({ isLobby: false, isHost: false, mySeat: 2 })).toBeNull();
  });
});

describe('buildEndedWaitingMessage', () => {
  it('shows the hint to a seated non-host player once the game has ended', () => {
    expect(buildEndedWaitingMessage({ isEnded: true, isHost: false, mySeat: 3 })).toBe(
      '等待房主操作（再来一局 / 返回大厅）',
    );
  });

  it('hides the hint from the host, who holds the rematch actions', () => {
    expect(buildEndedWaitingMessage({ isEnded: true, isHost: true, mySeat: 0 })).toBeNull();
  });

  it('hides the hint from a spectator without a seat', () => {
    expect(buildEndedWaitingMessage({ isEnded: true, isHost: false, mySeat: null })).toBeNull();
  });

  it('hides the hint before the game has ended', () => {
    expect(buildEndedWaitingMessage({ isEnded: false, isHost: false, mySeat: 3 })).toBeNull();
  });
});

describe('buildStepActorWaitingMessage', () => {
  it('names the current step actor from the progress label', () => {
    expect(buildStepActorWaitingMessage({ current: 2, total: 5, label: '预言家' })).toBe(
      '正在等待 预言家 行动',
    );
  });

  it('is null when the phase has no step progress', () => {
    expect(buildStepActorWaitingMessage(null)).toBeNull();
  });

  it('is null when the step has no actor label', () => {
    expect(buildStepActorWaitingMessage({ current: 1, total: 3, label: '' })).toBeNull();
  });
});

describe('resolveViewIdentityAction / buildViewIdentityButton', () => {
  it('exposes the canonical identity label', () => {
    expect(VIEW_IDENTITY_LABEL).toBe('查看身份');
  });

  it('resolves to null when the audience predicate hides the action', () => {
    expect(
      resolveViewIdentityAction({ isVisible: false, label: '查看身份', onPress: () => {} }),
    ).toBeNull();
  });

  it('carries the game label and handler through unchanged', () => {
    const onPress = () => {};
    expect(resolveViewIdentityAction({ isVisible: true, label: '查看我的词', onPress })).toEqual({
      label: '查看我的词',
      onPress,
    });
  });

  it('renders an always-enabled bottom button with the surface anchors', () => {
    const onPress = () => {};
    const action = resolveViewIdentityAction({ isVisible: true, label: '查看身份', onPress });
    if (action === null) throw new Error('expected a resolved action');
    expect(
      buildViewIdentityButton(action, {
        key: 'viewRole',
        variant: 'secondary',
        size: 'md',
        testID: 'avalon-view-role',
      }),
    ).toEqual({
      key: 'viewRole',
      label: '查看身份',
      variant: 'secondary',
      size: 'md',
      testID: 'avalon-view-role',
      isEnabled: true,
      onPress,
    });
  });

  it('omits the testID key entirely when the surface has none', () => {
    const action = resolveViewIdentityAction({
      isVisible: true,
      label: '查看题目',
      onPress: () => {},
    });
    if (action === null) throw new Error('expected a resolved action');
    const button = buildViewIdentityButton(action, {
      key: 'view-identity',
      variant: 'secondary',
      size: 'md',
    });
    expect('testID' in button).toBe(false);
  });
});

describe('buildPreparationFailureMessage', () => {
  it('joins the game reason with the shared host wait', () => {
    expect(buildPreparationFailureMessage({ reason: '词语准备失败', hostAction: '重新准备' })).toBe(
      '词语准备失败，等待房主重新准备',
    );
    expect(buildPreparationFailureMessage({ reason: '暂无可用词语', hostAction: '处理' })).toBe(
      '暂无可用词语，等待房主处理',
    );
  });
});
