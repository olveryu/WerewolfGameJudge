/**
 * Schema-driven config screen contract, exercised through the Demo module:
 * create mode starts from schema defaults, count edits validate inline and gate
 * the submit button, reset restores the baseline, and edit mode dispatches the
 * game's update command before returning to the room.
 */

import {
  DEMO_CONFIG_SCHEMA,
  type DemoCommand,
  type DemoState,
} from '@game-judge/game-engine/games/demo/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { createGameConfigScreen } from '@/features/room/config/createGameConfigScreen';
import type { RoomCreationRequest, RoomRecord } from '@/features/room/model/RoomDirectory';
import { buildDemoTestState } from '@/games/demo/__tests__/buildDemoTestState';
import { parseDemoConfigRouteParams } from '@/games/demo/navigation/demoGameNavigation';
import { getDemoRoomCommandFailureMessage } from '@/games/demo/room/demoRoomCommandFailureMessage';
import type { RoomLink } from '@/platform/realtime/types';
import {
  createFakeRoomLink,
  idleLinkSnapshot,
  readyLinkSnapshot,
  testIdentity,
} from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { TESTIDS } from '@/testids';

const mockCreateRoom = jest.fn<Promise<RoomRecord>, [RoomCreationRequest]>();
jest.mock('@/features/room/controllers/useRoomCreationController', () => ({
  useRoomCreationController: () => ({ createRoom: mockCreateRoom, isCreating: false }),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  replace: jest.fn(),
  popTo: jest.fn(),
  getState: jest.fn(() => ({ routes: [] })),
};
let mockRouteParams: unknown;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

const mockReplaceWithCreatedRoom = jest.fn<void, [unknown, string]>();
const mockReturnToActiveRoom = jest.fn<void, [unknown, string]>();
jest.mock('@/features/room/navigation/roomFlowNavigation', () => ({
  replaceWithCreatedRoom: (navigation: unknown, roomCode: string) =>
    mockReplaceWithCreatedRoom(navigation, roomCode),
  returnToActiveRoom: (navigation: unknown, roomCode: string) =>
    mockReturnToActiveRoom(navigation, roomCode),
}));

const DemoConfigScreen = createGameConfigScreen<
  'demo',
  DemoState,
  DemoCommand,
  DemoState['config']
>({
  gameType: 'demo',
  displayName: 'Demo',
  definition: {
    schema: DEMO_CONFIG_SCHEMA,
    parseRouteParams: parseDemoConfigRouteParams,
    readConfig: (state) => (state.phase.kind === 'lobby' ? state.config : null),
    buildUpdateCommand: (config) => ({ type: 'demo.config.update', config }),
    getFailureMessage: getDemoRoomCommandFailureMessage,
    creationLabel: '创建Demo房间',
  },
});

function createSession(state: DemoState | null): RoomLink<DemoState, DemoCommand> {
  return createFakeRoomLink<DemoState, DemoCommand>(
    state === null
      ? idleLinkSnapshot()
      : readyLinkSnapshot(
          testIdentity('demo', { roomCode: state.roomCode, userId: 'test-uid' }),
          createRoomSnapshot(state, 1),
        ),
    async () => successfulRoomCommand(state ?? buildDemoTestState()),
  );
}

const playerCount = () => TESTIDS.gameConfigField('demo', 'numberOfPlayers');
const submit = () => TESTIDS.gameConfigSubmit('demo');

describe('createGameConfigScreen (demo)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRoom.mockResolvedValue({
      roomCode: '4242',
      roomId: 'room-4242',
      gameType: 'demo',
      hostUserId: 'test-uid',
      createdAt: new Date(0),
    });
  });

  it('create mode shows the schema defaults, title and summary', () => {
    mockRouteParams = { gameType: 'demo', mode: 'create' };
    const screen = render(<DemoConfigScreen session={createSession(null)} />);
    expect(screen.getByText('Demo设置')).toBeTruthy();
    expect(screen.getByTestId(playerCount()).props.value).toBe('6');
    expect(screen.getByText('共 6 人')).toBeTruthy();
    expect(screen.getByText('创建房间')).toBeTruthy();
  });

  it('shows an inline issue and disables submit for an out-of-range count', async () => {
    mockRouteParams = { gameType: 'demo', mode: 'create' };
    const screen = render(<DemoConfigScreen session={createSession(null)} />);
    fireEvent.changeText(screen.getByTestId(playerCount()), '13');
    expect(
      screen.getByTestId(TESTIDS.gameConfigFieldIssue('demo', 'numberOfPlayers')),
    ).toHaveTextContent('玩家人数需为 4 至 12 的整数');
    fireEvent.press(screen.getByTestId(submit()));
    await waitFor(() => expect(mockCreateRoom).not.toHaveBeenCalled());
  });

  it('disables the increment at max and the decrement at min', () => {
    mockRouteParams = { gameType: 'demo', mode: 'create' };
    const screen = render(<DemoConfigScreen session={createSession(null)} />);
    fireEvent.changeText(screen.getByTestId(playerCount()), '12');
    fireEvent.press(screen.getByLabelText('增加人数'));
    expect(screen.getByTestId(playerCount()).props.value).toBe('12');
    fireEvent.changeText(screen.getByTestId(playerCount()), '4');
    fireEvent.press(screen.getByLabelText('减少人数'));
    expect(screen.getByTestId(playerCount()).props.value).toBe('4');
  });

  it('stepping after typing a count continues from the typed value', () => {
    mockRouteParams = { gameType: 'demo', mode: 'create' };
    const screen = render(<DemoConfigScreen session={createSession(null)} />);
    fireEvent.changeText(screen.getByTestId(playerCount()), '5');
    fireEvent.press(screen.getByLabelText('增加人数'));
    expect(screen.getByTestId(playerCount()).props.value).toBe('6');
    fireEvent.press(screen.getByLabelText('增加人数'));
    expect(screen.getByTestId(playerCount()).props.value).toBe('7');
  });

  it('reset restores the schema defaults', () => {
    mockRouteParams = { gameType: 'demo', mode: 'create' };
    const screen = render(<DemoConfigScreen session={createSession(null)} />);
    fireEvent.press(screen.getByLabelText('增加人数'));
    expect(screen.getByTestId(playerCount()).props.value).toBe('7');
    fireEvent.press(screen.getByTestId(TESTIDS.gameConfigReset('demo')));
    expect(screen.getByTestId(playerCount()).props.value).toBe('6');
  });

  it('create submits the config record and navigates to the created room', async () => {
    mockRouteParams = { gameType: 'demo', mode: 'create' };
    const screen = render(<DemoConfigScreen session={createSession(null)} />);
    fireEvent.press(screen.getByLabelText('增加人数'));
    fireEvent.press(screen.getByTestId(submit()));
    await waitFor(() =>
      expect(mockCreateRoom).toHaveBeenCalledWith({
        expectedHostUserId: 'test-uid',
        gameType: 'demo',
        config: { numberOfPlayers: 7 },
      }),
    );
    await waitFor(() =>
      expect(mockReplaceWithCreatedRoom).toHaveBeenCalledWith(mockNavigation, '4242'),
    );
  });

  it('edit mode loads the lobby config, dispatches the update and returns to the room', async () => {
    const state = buildDemoTestState({ roomCode: '7777', config: { numberOfPlayers: 8 } });
    mockRouteParams = { gameType: 'demo', mode: 'edit', roomCode: '7777' };
    const session = createSession(state);
    const screen = render(<DemoConfigScreen session={session} />);
    expect(screen.getByTestId(playerCount()).props.value).toBe('8');
    expect(screen.getByText('保存设置')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('减少人数'));
    fireEvent.press(screen.getByTestId(submit()));
    await waitFor(() =>
      expect(session.dispatch).toHaveBeenCalledWith(
        { type: 'demo.config.update', config: { numberOfPlayers: 7 } },
        { controlledSeat: null, label: '保存设置', durable: false },
      ),
    );
    await waitFor(() =>
      expect(mockReturnToActiveRoom).toHaveBeenCalledWith(mockNavigation, '7777'),
    );
  });

  it('edit mode fails fast when the session is not the requested lobby', () => {
    mockRouteParams = { gameType: 'demo', mode: 'edit', roomCode: '7777' };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<DemoConfigScreen session={createSession(null)} />)).toThrow(
      /demo config edit requires its active room session/,
    );
    spy.mockRestore();
  });
});
