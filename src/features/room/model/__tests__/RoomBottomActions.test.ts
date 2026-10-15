import { buildLobbyHostStartMessage } from '../RoomBottomActions';

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
