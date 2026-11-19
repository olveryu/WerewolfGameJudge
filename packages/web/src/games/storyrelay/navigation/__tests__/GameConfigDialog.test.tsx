import {
  DEFAULT_STORY_RELAY_CONFIG,
  STORY_RELAY_CONFIG_SCHEMA,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { useAuthContext } from '@/contexts/AuthContext';
import { createGameConfigDefiner } from '@/features/room/config/createGameConfigScreen';
import { parseStoryRelayConfigRouteParams } from '@/games/storyrelay/navigation/storyRelayGameNavigation';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: vi.fn() }));
vi.mock('@/contexts/ServiceContext', () => ({
  useServices: () => ({ roomCreator: { createRoom: vi.fn() } }),
}));

const ConfigScreen = createGameConfigDefiner<'storyrelay', StoryRelayState, StoryRelayCommand>(
  'storyrelay',
  '轮流讲故事',
)({
  schema: STORY_RELAY_CONFIG_SCHEMA,
  parseRouteParams: parseStoryRelayConfigRouteParams,
  readConfig: (state) => (state.phase === 'lobby' ? state.config : null),
  buildUpdateCommand: (config) => ({ type: 'storyrelay.config.update', config }),
  getFailureMessage: () => '保存失败',
  creationLabel: '创建房间',
});

function renderDialog() {
  const state = storyRelayEngine.createInitialState(DEFAULT_STORY_RELAY_CONFIG, {
    roomCode: '2468',
    hostUserId: 'host',
    commandId: 'create',
    nowMs: 1000,
  });
  const session = createFakeRoomLink<StoryRelayState, StoryRelayCommand>(
    readyLinkSnapshot(
      testIdentity('storyrelay', { roomCode: '2468' }),
      createRoomSnapshot(state, 1),
    ),
    () => Promise.resolve(successfulRoomCommand(state)),
  );
  const onClose = vi.fn();
  vi.mocked(useAuthContext).mockReturnValue({
    user: { id: 'host' },
  } as ReturnType<typeof useAuthContext>);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/room/2468']}>
        <ConfigScreen session={session} dialog={{ roomCode: '2468', onClose }} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { state, session, onClose };
}

it('saves settings in the existing room and closes the dialog', async () => {
  const { session, onClose } = renderDialog();
  fireEvent.click(screen.getByTestId(TESTIDS.gameConfigSubmit('storyrelay')));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(session.dispatch).toHaveBeenCalledOnce();
});

it('retains the dialog and prevents saving after host authority changes', () => {
  const { session, state, onClose } = renderDialog();
  act(() => session.publishRoom(createRoomSnapshot({ ...state, hostUserId: 'other' }, 2)));
  expect(screen.getByRole('dialog', { name: '房间设置' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('房间状态或权限已变化');
  expect(screen.getByTestId(TESTIDS.gameConfigSubmit('storyrelay'))).toBeDisabled();
  expect(session.dispatch).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});
