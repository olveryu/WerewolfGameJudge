import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { resolveBgmTrackUrls } from '@/features/product/model/BgmCatalog';
import { audioSettings } from '@/features/settings/audioSettings';

/** Music and volume operations supplied by a game's AudioService adapter. */
export interface RoomBgmPlaybackPort {
  readonly startBgm: (urls: readonly string[]) => void;
  readonly stopBgm: () => void;
  readonly isBgmPlaying: () => boolean;
  readonly subscribeBgm: (listener: () => void) => () => void;
  readonly setBgmVolume: (volume: number) => void;
  readonly setGameAudioVolume: (volume: number) => void;
}

export interface RoomBgmControlState {
  readonly isBgmPlaying: boolean;
  readonly playBgm: () => void;
  readonly stopBgm: () => void;
  readonly startBgmIfEnabled: () => void;
}

/** Host-only music preferences; games decide when music is automatic, manual, or off. */
export function useRoomBgmControl(
  audio: RoomBgmPlaybackPort,
  isHost: boolean,
  lifecycle: 'auto' | 'manual' | 'off',
): RoomBgmControlState {
  const isBgmPlaying = useSyncExternalStore(audio.subscribeBgm, audio.isBgmPlaying);
  const playBgm = useCallback(() => {
    const settings = audioSettings.getSnapshot();
    audio.setBgmVolume(settings.bgmVolume);
    audio.startBgm(resolveBgmTrackUrls(settings.bgmTrack));
  }, [audio]);
  const startBgmIfEnabled = useCallback(() => {
    if (audioSettings.getSnapshot().bgmEnabled) playBgm();
  }, [playBgm]);

  useEffect(() => {
    if (isHost) audio.setGameAudioVolume(audioSettings.getSnapshot().gameAudioVolume);
  }, [audio, isHost]);

  useEffect(() => {
    if (!isHost) return;
    if (lifecycle === 'auto') startBgmIfEnabled();
    else audio.stopBgm();
  }, [audio, isHost, lifecycle, startBgmIfEnabled]);

  useEffect(() => {
    if (isHost) return audio.stopBgm;
  }, [isHost, audio.stopBgm]);

  return { isBgmPlaying, playBgm, stopBgm: audio.stopBgm, startBgmIfEnabled };
}
