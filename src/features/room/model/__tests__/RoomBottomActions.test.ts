import {
  buildEndedWaitingMessage,
  buildLobbyHostStartMessage,
  buildPreparationFailureMessage,
  buildStepActorWaitingMessage,
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
