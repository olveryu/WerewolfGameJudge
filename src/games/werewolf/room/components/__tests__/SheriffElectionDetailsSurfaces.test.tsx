/** Presentational coverage for adaptive sheriff-election surfaces. */

import { fireEvent, render } from '@testing-library/react-native';

import {
  SheriffElectionInspector,
  SheriffElectionSheet,
} from '@/games/werewolf/room/components/SheriffElectionDetailsSurfaces';
import { SheriffElectionHud } from '@/games/werewolf/room/components/SheriffElectionHud';
import { createSheriffElectionPanelStyles } from '@/games/werewolf/room/components/sheriffElectionPanel.styles';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import { TESTIDS } from '@/testids';
import { colors } from '@/theme';

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
  pendingAction: null,
  register: jest.fn(async () => undefined),
  cancelRegistration: jest.fn(async () => undefined),
  withdraw: jest.fn(async () => undefined),
  vote: jest.fn(async () => undefined),
  advance: jest.fn(async () => undefined),
  requestEndBySelfDestruct: jest.fn(),
};
const styles = createSheriffElectionPanelStyles(colors);

describe('adaptive sheriff-election surfaces', () => {
  it('opens details from the compact privacy-safe HUD', () => {
    const openDetails = jest.fn();
    const screen = render(
      <SheriffElectionHud model={model} styles={styles} onOpenDetails={openDetails} />,
    );

    expect(screen.getByTestId(TESTIDS.sheriffElectionHudPhase)).toHaveTextContent('报名上警');
    expect(screen.queryByText(/1号|2号/)).toBeNull();
    fireEvent.press(screen.getByTestId(TESTIDS.sheriffElectionHud));
    expect(openDetails).toHaveBeenCalledTimes(1);
  });

  it('renders and closes the compact details sheet', () => {
    const close = jest.fn();
    const screen = render(
      <SheriffElectionSheet visible model={model} styles={styles} onClose={close} />,
    );

    expect(screen.getByTestId(TESTIDS.sheriffElectionSheet)).toBeTruthy();
    fireEvent.press(screen.getByTestId(TESTIDS.sheriffDetailsCloseButton));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('renders details in the persistent wide inspector', () => {
    const screen = render(<SheriffElectionInspector model={model} styles={styles} />);
    expect(screen.getByTestId(TESTIDS.sheriffElectionInspector)).toBeTruthy();
    expect(screen.getByTestId(TESTIDS.sheriffElectionPanel)).toBeTruthy();
  });
});
