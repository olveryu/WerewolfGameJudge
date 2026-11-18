import { IconButton } from '@/components/IconButton';
import type { RoomBgmControlState } from '@/features/room/audio/useRoomBgmControl';
import { TESTIDS } from '@/testids';
import IconMusicalNotes from '~icons/ion/musical-notes';
import IconPause from '~icons/ion/pause';

/** Host music control backed by the player's actual playback state. */
export function RoomBgmToggle({ bgm }: { readonly bgm: RoomBgmControlState }) {
  return (
    <IconButton
      label={bgm.isBgmPlaying ? '暂停音乐' : '播放音乐'}
      icon={bgm.isBgmPlaying ? <IconPause aria-hidden /> : <IconMusicalNotes aria-hidden />}
      onClick={bgm.isBgmPlaying ? bgm.stopBgm : bgm.playBgm}
      data-testid={TESTIDS.bgmToggleButton}
    />
  );
}
