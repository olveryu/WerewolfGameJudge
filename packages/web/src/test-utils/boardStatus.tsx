import { RoomActionStatus } from '@/features/room/components/RoomActionStatus';
import type { RoomBoardStatusModel } from '@/features/room/model/RoomBoardStatus';

/** Renders a game's board status the way the room shell does, with no prompt override. */
export function BoardStatusPreview({ status }: { readonly status: RoomBoardStatusModel }) {
  return (
    <RoomActionStatus
      model={{ message: null, progress: null, actions: [], group: null }}
      isAudioPlaying={false}
      hostManagement={null}
      board={{
        phaseLabel: null,
        lobbyTitle: null,
        lobbyDetail: null,
        icon: null,
        gameStatus: status,
        notices: [],
      }}
    />
  );
}
