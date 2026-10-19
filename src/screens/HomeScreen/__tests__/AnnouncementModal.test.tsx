/** AnnouncementModal: the changelog leads the tab bar and is the default page. */

import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ANNOUNCEMENT_VERSIONS, ANNOUNCEMENTS } from '@/config/announcements';
import type { ClientGameAnnouncementTab } from '@/games/home';

import { AnnouncementModal } from '../components/AnnouncementModal';

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: null }),
}));

const gameTabs: readonly ClientGameAnnouncementTab[] = [
  {
    key: 'werewolf:boards',
    label: '板子',
    Content: () => <Text>板子内容</Text>,
  },
];

function renderModal() {
  return render(
    <AnnouncementModal
      visible
      gameTabs={gameTabs}
      onClose={jest.fn()}
      hasUnreadFeedback={false}
      onUnreadFeedbackChange={jest.fn()}
    />,
  );
}

it('opens on the changelog with the latest version first', () => {
  const screen = renderModal();
  const latestVersion = ANNOUNCEMENT_VERSIONS[0] ?? '';
  const latest = ANNOUNCEMENTS[latestVersion];
  if (latest === undefined) {
    throw new Error('expected at least one announcement entry');
  }
  expect(screen.getByText(latest.title)).toBeTruthy();
  expect(screen.queryByText('板子内容')).toBeNull();
});

it('orders the tabs changelog, game tabs, feedback', () => {
  const screen = renderModal();
  const labels = screen.getAllByText(/^(更新日志|板子|意见反馈)$/).map((node) => {
    const child: unknown = node.props.children;
    return typeof child === 'string' ? child : '';
  });
  expect(labels).toEqual(['更新日志', '板子', '意见反馈']);
});

it('switches to a game tab and back to the changelog', () => {
  const screen = renderModal();
  fireEvent.press(screen.getByText('板子'));
  expect(screen.getByText('板子内容')).toBeTruthy();
  fireEvent.press(screen.getByText('更新日志'));
  const latestVersion = ANNOUNCEMENT_VERSIONS[0] ?? '';
  const latest = ANNOUNCEMENTS[latestVersion];
  if (latest === undefined) {
    throw new Error('expected at least one announcement entry');
  }
  expect(screen.getByText(latest.title)).toBeTruthy();
  expect(screen.queryByText('板子内容')).toBeNull();
});
