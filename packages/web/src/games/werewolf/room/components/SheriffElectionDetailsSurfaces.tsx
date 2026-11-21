/** Adaptive containers for sheriff details: a bottom sheet on compact screens, an inspector on wide ones. */
import './SheriffElection.css';

import { BottomSheet } from '@/components/BottomSheet';
import { IconButton } from '@/components/IconButton';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';
import IconClose from '~icons/ion/close';

import { SheriffElectionPanel } from './SheriffElectionPanel';

/** Mounted means open. */
export function SheriffElectionSheet({
  model,
  onClose,
}: {
  readonly model: SheriffElectionPanelModel;
  readonly onClose: () => void;
}) {
  return (
    <BottomSheet title="警长竞选详情" onClose={onClose} testId={TESTIDS.sheriffElectionSheet}>
      <div className="sheriff-sheet-close">
        <IconButton
          label="关闭警长竞选详情"
          icon={<IconClose aria-hidden />}
          onClick={onClose}
          data-testid={TESTIDS.sheriffDetailsCloseButton}
        />
      </div>
      <div className="sheriff-sheet-scroll">
        <SheriffElectionPanel model={model} />
      </div>
    </BottomSheet>
  );
}

export function SheriffElectionInspector({ model }: { readonly model: SheriffElectionPanelModel }) {
  return (
    <aside
      className="sheriff-inspector"
      aria-label="警长竞选"
      data-testid={TESTIDS.sheriffElectionInspector}
    >
      <SheriffElectionPanel model={model} />
    </aside>
  );
}
