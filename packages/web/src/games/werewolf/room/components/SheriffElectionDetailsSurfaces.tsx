/** Centered room dialog for sheriff election details. */
import './SheriffElection.css';

import { RoomDialog } from '@/features/room/components/RoomDialog';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';

import { SheriffElectionPanel } from './SheriffElectionPanel';

/** Mounted means open. */
export function SheriffElectionDialog({
  model,
  onClose,
}: {
  readonly model: SheriffElectionPanelModel;
  readonly onClose: () => void;
}) {
  return (
    <RoomDialog
      title="警长竞选详情"
      onClose={onClose}
      testId={TESTIDS.sheriffElectionDialog}
      isContentFlush
      dismissOnEscape
      footer={null}
    >
      <SheriffElectionPanel model={model} />
    </RoomDialog>
  );
}
