/** 组队选人弹窗：名单多选、满员确认、最终 modal 预选预勾与预选标记、提交中禁用。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react';

import { type AvalonTeamPickKind, AvalonTeamPickModal } from '../AvalonTeamPickModal';

function nominateViewModel(overrides: Partial<AvalonViewModel> = {}): AvalonViewModel {
  return {
    phase: 'nominate',
    mySeat: 4,
    myRole: 'loyalServant',
    seats: [0, 1, 2, 3, 4].map((seat) => ({
      seat,
      displayName: `玩家${seat + 1}`,
      isBot: false,
      isLeader: seat === 4,
      role: null,
    })),
    leaderSeat: 4,
    nightStep: null,
    evilPeers: null,
    merlinSees: null,
    percivalSees: null,
    nightConfirmed: false,
    hasViewedRole: true,
    unviewedRoleSeats: [],
    requiredSize: 2,
    preselectedSeats: null,
    proposedSeats: null,
    teamSeats: null,
    myBallot: null,
    pendingVoteSeats: null,
    pendingPlaySeats: null,
    ballots: null,
    voteCounts: null,
    myPlay: null,
    questResults: [],
    questHistory: [],
    roundHistory: [],
    lady: null,
    ladyCheckResult: null,
    ladyHistory: [],
    isAssassin: false,
    canEarlyStrike: false,
    accusedSeat: null,
    winner: null,
    endReason: null,
    rejectStreak: 0,
    vetoLimit: 5,
    voteMode: 'public',
    playerCount: 5,
    lastVoteResult: null,
    ...overrides,
  };
}

function renderModal(
  kind: AvalonTeamPickKind,
  overrides: Partial<AvalonViewModel> = {},
  isSubmitting = false,
) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <AvalonTeamPickModal
      viewModel={nominateViewModel(overrides)}
      kind={kind}
      isSubmitting={isSubmitting}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );
  return { ...utils, onConfirm, onClose };
}

function countText(node: HTMLElement): string | null {
  return node.textContent;
}

describe('AvalonTeamPickModal', () => {
  it('preselect modal starts empty and confirms only at full size', () => {
    const { getByTestId, onConfirm } = renderModal('preselect');
    expect(countText(getByTestId('avalon-team-pick-count'))).toBe('已选 0/2');
    expect(getByTestId('avalon-team-pick-modal')).toBeTruthy();
    expect(getByTestId('avalon-team-pick-row-0')).toBeTruthy();
    fireEvent.click(getByTestId('avalon-team-pick-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(getByTestId('avalon-team-pick-row-0'));
    expect(countText(getByTestId('avalon-team-pick-count'))).toBe('已选 1/2');
    fireEvent.click(getByTestId('avalon-team-pick-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(getByTestId('avalon-team-pick-row-1'));
    expect(countText(getByTestId('avalon-team-pick-count'))).toBe('已选 2/2');
    fireEvent.click(getByTestId('avalon-team-pick-confirm'));
    expect(onConfirm).toHaveBeenCalledWith([0, 1]);
  });

  it('shows a hint and keeps the selection when tapping past full size', () => {
    const { getByTestId, getByText, onConfirm } = renderModal('preselect');
    fireEvent.click(getByTestId('avalon-team-pick-row-0'));
    fireEvent.click(getByTestId('avalon-team-pick-row-1'));
    fireEvent.click(getByTestId('avalon-team-pick-row-2'));
    expect(getByText('已满员，取消已选座位后再选。')).toBeTruthy();
    expect(countText(getByTestId('avalon-team-pick-count'))).toBe('已选 2/2');
    fireEvent.click(getByTestId('avalon-team-pick-confirm'));
    expect(onConfirm).toHaveBeenCalledWith([0, 1]);
  });

  it('final modal opens pre-checked with the preselect and tags it', () => {
    const { getByTestId, getAllByText, onConfirm } = renderModal('final', {
      preselectedSeats: [0, 1],
    });
    expect(countText(getByTestId('avalon-team-pick-count'))).toBe('已选 2/2');
    expect(getAllByText('预选')).toHaveLength(2);
    fireEvent.click(getByTestId('avalon-team-pick-confirm'));
    expect(onConfirm).toHaveBeenCalledWith([0, 1]);
    // Unchecking one preselected seat drops below full size: confirm locks again.
    fireEvent.click(getByTestId('avalon-team-pick-row-1'));
    expect(countText(getByTestId('avalon-team-pick-count'))).toBe('已选 1/2');
    fireEvent.click(getByTestId('avalon-team-pick-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancel closes without confirming and submitting disables the rows', () => {
    const { getByTestId, onConfirm, onClose, unmount } = renderModal('preselect');
    fireEvent.click(getByTestId('avalon-team-pick-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    // The sheet portals into document.body, so the first mount must go before the second.
    unmount();
    const submitting = renderModal('preselect', {}, true);
    expect(submitting.getByTestId('avalon-team-pick-row-0')).toBeDisabled();
    expect(submitting.getByTestId('avalon-team-pick-confirm')).toBeDisabled();
  });
});
