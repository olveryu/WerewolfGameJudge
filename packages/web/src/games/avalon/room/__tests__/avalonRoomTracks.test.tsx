import {
  type AvalonViewModel,
  getAvalonViewModel,
} from '@game-judge/game-engine/games/avalon/public';
import { render, screen, within } from '@testing-library/react';

import { RoomTracks } from '@/features/room/components/RoomTracks';
import { playAvalonTestGame } from '@/test-utils/avalonState';

import { buildAvalonRoomTracks } from '../avalonRoomTracks';

function AvalonTracks({ view }: { readonly view: AvalonViewModel }) {
  return <RoomTracks tracks={buildAvalonRoomTracks(view)} />;
}

it('marks the first and next mission even before a proposal is recorded', () => {
  const first = playAvalonTestGame(0);
  const { rerender } = render(<AvalonTracks view={getAvalonViewModel(first, 0)} />);
  const firstTrack = screen.getByRole('list', { name: '任务轨道' });
  expect(within(firstTrack).getByText('任务1').parentElement).toHaveAttribute(
    'data-state',
    'current',
  );
  const next = playAvalonTestGame(1);
  rerender(<AvalonTracks view={getAvalonViewModel(next, 0)} />);
  const nextTrack = screen.getByRole('list', { name: '任务轨道' });
  expect(within(nextTrack).getByText('任务1').parentElement).toHaveAttribute('data-state', 'fail');
  expect(within(nextTrack).getByText('任务2').parentElement).toHaveAttribute(
    'data-state',
    'current',
  );
});

it('keeps the final proposal track without a current attempt after the game ends', () => {
  const state = playAvalonTestGame(3);
  render(<AvalonTracks view={getAvalonViewModel(state, 0)} />);
  const track = screen.getByRole('list', { name: '组队次数' });
  expect(within(track).queryByText('当前')).not.toBeInTheDocument();
  expect(within(track).getByText('已通过')).toBeVisible();
});

it('shows the last automatic proposal after a migrated final rejection', () => {
  const view = getAvalonViewModel(playAvalonTestGame(1), 0);
  const record = view.roundHistory[0];
  const proposal = record?.proposals[0];
  if (record === undefined || proposal === undefined) throw new Error('Expected proposal history');
  const rejected = { ...proposal, approved: false, automatic: false };
  const automatic = { ...proposal, approved: true, automatic: true };
  render(
    <AvalonTracks
      view={{
        ...view,
        phase: 'questResult',
        vetoLimit: 3,
        roundHistory: [{ ...record, proposals: [rejected, rejected, rejected, automatic] }],
      }}
    />,
  );
  const track = screen.getByRole('list', { name: '组队次数' });
  expect(within(track).getAllByText('已否决')).toHaveLength(2);
  expect(within(track).getByText('已通过')).toBeVisible();
});
