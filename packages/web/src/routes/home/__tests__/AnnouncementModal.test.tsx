/** AnnouncementModal: the changelog leads the tab bar and is the default page. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy } from 'react';

import { ANNOUNCEMENT_VERSIONS, ANNOUNCEMENTS } from '@/config/announcements';
import type { ClientGameAnnouncementTab } from '@/games/catalog';

import { AnnouncementModal } from '../AnnouncementModal';

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: null, loading: false, error: null }),
}));
vi.mock('@/features/feedback/queries/useUnreadFeedback', () => ({
  useUnreadFeedback: () => ({ data: 0, setUnreadFeedbackCount: vi.fn() }),
}));

const gameTabs: readonly ClientGameAnnouncementTab[] = [
  {
    key: 'werewolf:boards',
    label: '板子',
    Content: lazy(async () => ({ default: () => <p>板子内容</p> })),
  },
];

function latestTitle(): string {
  const latest = ANNOUNCEMENTS[ANNOUNCEMENT_VERSIONS[0] ?? ''];
  if (latest === undefined) throw new Error('expected at least one announcement entry');
  return latest.title;
}

function renderModal(onClose = vi.fn()) {
  render(<AnnouncementModal open gameTabs={gameTabs} onClose={onClose} />);
  return onClose;
}

it('opens on the changelog with the latest version first', () => {
  renderModal();
  expect(screen.getByText(latestTitle())).toBeInTheDocument();
  expect(screen.queryByText('板子内容')).toBeNull();
});

it('orders the tabs changelog, game tabs, feedback', () => {
  renderModal();
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
    '更新日志',
    '板子',
    '意见反馈',
  ]);
});

it('switches to a game tab and back to the changelog', async () => {
  const user = userEvent.setup();
  renderModal();
  await user.click(screen.getByRole('tab', { name: '板子' }));
  expect(await screen.findByText('板子内容')).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: '更新日志' }));
  expect(await screen.findByText(latestTitle())).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('板子内容')).toBeNull());
});

it('closes through the close button', async () => {
  const user = userEvent.setup();
  const onClose = renderModal();
  await user.click(screen.getByRole('button', { name: '关闭公告' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
