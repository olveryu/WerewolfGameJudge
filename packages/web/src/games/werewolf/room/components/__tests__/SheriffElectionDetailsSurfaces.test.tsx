/** Presentational coverage for sheriff-election details. */

import { fireEvent, render, screen } from '@testing-library/react';

import { SheriffElectionDialog } from '@/games/werewolf/room/components/SheriffElectionDetailsSurfaces';
import { buildSheriffElectionBoardStatus } from '@/games/werewolf/room/day/sheriffElectionBoardStatus';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { BoardStatusPreview } from '@/test-utils/boardStatus';
import { TESTIDS } from '@/testids';

const model: SheriffElectionPanelModel = {
  view: {
    phase: 'registration',
    phaseTitle: '报名上警',
    phaseDescription:
      '房主请点击“结束报名”按钮（位于“主持管理”中）。想竞选警长的玩家可在手机上报名，系统随后将随机确定发言顺序。',
    candidateRecords: null,
    speakingInstruction: null,
    voteProgress: null,
    myBallot: null,
    candidateOptions: [],
    completedRounds: [],
    finalResult: null,
    canRegister: true,
    canCancelRegistration: false,
    canWithdraw: false,
    canVote: false,
    canAdvance: false,
    advanceLabel: null,
  },
  remainingSeconds: null,
  pendingAction: null,
  register: vi.fn(async () => undefined),
  cancelRegistration: vi.fn(async () => undefined),
  withdraw: vi.fn(async () => undefined),
  vote: vi.fn(async () => undefined),
  advance: vi.fn(async () => undefined),
  requestAdvance: vi.fn(),
  requestEndBySelfDestruct: vi.fn(),
};

describe('sheriff-election details', () => {
  it('shows a compact privacy-safe HUD without a details control', () => {
    render(<BoardStatusPreview status={buildSheriffElectionBoardStatus(model, false)} />);

    expect(screen.getByTestId(TESTIDS.sheriffElectionHudPhase)).toHaveTextContent('报名进行中');
    expect(screen.queryByText(/1号|2号/)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.sheriffDetailsButton)).not.toBeInTheDocument();
  });

  it('renders and closes the details dialog', () => {
    const close = vi.fn();
    render(<SheriffElectionDialog model={model} onClose={close} />);

    expect(screen.getByRole('dialog', { name: '警长竞选详情' })).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.sheriffElectionPanel)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(TESTIDS.roomDialogCloseButton));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
