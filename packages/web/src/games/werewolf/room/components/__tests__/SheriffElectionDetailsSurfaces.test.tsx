/** Presentational coverage for adaptive sheriff-election surfaces. */

import { fireEvent, render, screen } from '@testing-library/react';

import {
  SheriffElectionInspector,
  SheriffElectionSheet,
} from '@/games/werewolf/room/components/SheriffElectionDetailsSurfaces';
import { SheriffElectionHud } from '@/games/werewolf/room/components/SheriffElectionHud';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
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

describe('adaptive sheriff-election surfaces', () => {
  it('opens details from the compact privacy-safe HUD', () => {
    const openDetails = vi.fn();
    render(<SheriffElectionHud model={model} onOpenDetails={openDetails} />);

    expect(screen.getByTestId(TESTIDS.sheriffElectionHudPhase)).toHaveTextContent('报名上警');
    expect(screen.queryByText(/1号|2号/)).toBeNull();
    fireEvent.click(screen.getByTestId(TESTIDS.sheriffElectionHud));
    expect(openDetails).toHaveBeenCalledTimes(1);
  });

  it('renders and closes the compact details sheet', () => {
    const close = vi.fn();
    render(<SheriffElectionSheet model={model} onClose={close} />);

    expect(screen.getByTestId(TESTIDS.sheriffElectionSheet)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(TESTIDS.sheriffDetailsCloseButton));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('renders details in the persistent wide inspector', () => {
    render(<SheriffElectionInspector model={model} />);
    expect(screen.getByTestId(TESTIDS.sheriffElectionInspector)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.sheriffElectionPanel)).toBeInTheDocument();
  });
});
