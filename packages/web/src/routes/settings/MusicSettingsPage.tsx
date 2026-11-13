import './SettingsPage.css';
import './MusicSettingsPage.css';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useParams } from 'react-router';

import { LoadingScreen } from '@/components/LoadingScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Switch } from '@/components/Switch';
import { useServices } from '@/contexts/ServiceContext';
import {
  BGM_TRACKS,
  type BgmTrackEntry,
  type BgmTrackSetting,
} from '@/features/product/model/BgmCatalog';
import { roomPath } from '@/features/room/navigation/roomFlowNavigation';
import { audioSettings } from '@/features/settings/audioSettings';
import { isExpectedStorageError } from '@/features/settings/services/userSettingsStorage';
import { type ClientGameAudioPreview, loadClientGameAudioPreviews } from '@/games/catalog';
import type { AudioService } from '@/services/infra/AudioService';
import { TESTIDS } from '@/testids';
import { handleError } from '@/utils/errorPipeline';
import { createLogger } from '@/utils/logger';
import IconMusicalNotes from '~icons/ion/musical-notes';
import IconPlayCircle from '~icons/ion/play-circle';
import IconShuffle from '~icons/ion/shuffle';
import IconStopCircle from '~icons/ion/stop-circle';
import IconVolumeHigh from '~icons/ion/volume-high';
import IconVolumeLow from '~icons/ion/volume-low';

const musicSettingsLog = createLogger('MusicSettings');
const VOLUME_STEPS = 100;

function reportSaveFailure(error: unknown): void {
  handleError(error, {
    label: '保存音乐设置',
    logger: musicSettingsLog,
    alertMessage: '设置未保存，请检查浏览器存储权限后重试',
    isExpected: isExpectedStorageError,
  });
}

/** Runs a synchronous settings write; a failed write leaves the store unchanged and is reported. */
function saveSetting(write: () => void): boolean {
  try {
    write();
    return true;
  } catch (error: unknown) {
    reportSaveFailure(error);
    return false;
  }
}

function EqualizerBars() {
  return (
    <span className="music-equalizer" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

function VolumeSlider({
  label,
  value,
  onValueChange,
  onCommit,
}: {
  readonly label: string;
  readonly value: number;
  readonly onValueChange: (value: number) => void;
  readonly onCommit: () => void;
}) {
  const percent = Math.round(value * VOLUME_STEPS);
  return (
    <div className="music-volume">
      <span className="music-volume-label">音量</span>
      <span className="music-volume-row">
        <IconVolumeLow aria-hidden />
        <input
          type="range"
          className="music-volume-input"
          min={0}
          max={VOLUME_STEPS}
          step={1}
          value={percent}
          aria-label={label}
          aria-valuetext={`${percent}%`}
          onChange={(event) => onValueChange(Number(event.target.value) / VOLUME_STEPS)}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          onBlur={onCommit}
        />
        <IconVolumeHigh aria-hidden />
      </span>
    </div>
  );
}

function TrackRow({
  track,
  isSelected,
  isPreviewing,
  onSelect,
  onPreviewToggle,
}: {
  readonly track: BgmTrackEntry;
  readonly isSelected: boolean;
  readonly isPreviewing: boolean;
  readonly onSelect: () => void;
  readonly onPreviewToggle: () => void;
}) {
  return (
    <div className="music-track" data-selected={isSelected || undefined}>
      <label className="music-track-select" data-testid={TESTIDS.musicBgmTrack(track.id)}>
        <input
          type="radio"
          className="music-radio"
          name="bgm-track"
          checked={isSelected}
          onChange={onSelect}
        />
        <span className="music-track-info">
          <span className="music-track-label">{track.label}</span>
          <span className="music-track-meta">
            <span className="music-track-subtitle">{track.subtitle}</span>
            <span className="music-track-mood">{track.mood}</span>
          </span>
        </span>
      </label>
      {isPreviewing && <EqualizerBars />}
      <button
        type="button"
        className="music-icon-button"
        data-active={isPreviewing || undefined}
        aria-label={isPreviewing ? `停止试听 ${track.label}` : `试听 ${track.label}`}
        onClick={onPreviewToggle}
      >
        {isPreviewing ? <IconStopCircle aria-hidden /> : <IconPlayCircle aria-hidden />}
      </button>
    </div>
  );
}

function BgmSection({ audioService }: { readonly audioService: AudioService }) {
  const settings = useSyncExternalStore(audioSettings.subscribe, audioSettings.getSnapshot);
  const isBgmPlaying = useSyncExternalStore(audioService.subscribeBgm, audioService.isBgmPlaying);
  const [requestedPreview, setRequestedPreview] = useState<BgmTrackEntry | null>(null);
  // The player owns playback truth: a preview it stopped (play() rejected) shows as stopped.
  const previewingTrack = isBgmPlaying ? requestedPreview : null;
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const previewActiveRef = useRef(false);

  useEffect(
    () => () => {
      if (previewActiveRef.current) audioService.stopBgm();
    },
    [audioService],
  );

  const stopPreview = () => {
    audioService.stopBgm();
    previewActiveRef.current = false;
    setRequestedPreview(null);
  };

  const toggleBgm = (enabled: boolean) => {
    saveSetting(() => audioSettings.setBgmEnabled(enabled));
    if (!enabled && previewActiveRef.current) stopPreview();
  };

  // Selection never starts or stops a preview: the two are independent.
  const selectTrack = (track: BgmTrackSetting) => {
    saveSetting(() => audioSettings.setBgmTrack(track));
  };

  const togglePreview = (track: BgmTrackEntry) => {
    if (previewingTrack?.id === track.id) {
      stopPreview();
      return;
    }
    // `startBgm` ignores the call while anything plays, so stop first.
    audioService.stopBgm();
    audioService.startBgm([track.url]);
    previewActiveRef.current = true;
    setRequestedPreview(track);
  };

  const changeVolume = (value: number) => {
    setVolumeDraft(value);
    audioService.setBgmVolume(value);
  };

  const commitVolume = () => {
    if (volumeDraft === null) return;
    setVolumeDraft(null);
    if (!saveSetting(() => audioSettings.setBgmVolume(volumeDraft))) {
      audioService.setBgmVolume(audioSettings.getSnapshot().bgmVolume);
    }
  };

  const disabled = !settings.bgmEnabled;
  return (
    <section className="settings-card">
      <div className="music-card-header">
        <h2 className="settings-card-title">
          <IconMusicalNotes aria-hidden className="music-title-icon" /> 背景音乐
        </h2>
        <Switch
          checked={settings.bgmEnabled}
          aria-label="背景音乐"
          onChange={(event) => toggleBgm(event.target.checked)}
        />
      </div>
      <div className="music-bgm-body" data-disabled={disabled || undefined}>
        <fieldset className="music-track-fieldset" disabled={disabled} aria-label="曲目">
          <label
            className="music-random"
            data-selected={settings.bgmTrack === 'random' || undefined}
          >
            <input
              type="radio"
              className="music-radio"
              name="bgm-track"
              checked={settings.bgmTrack === 'random'}
              onChange={() => selectTrack('random')}
            />
            <IconShuffle aria-hidden />
            <span>随机播放</span>
          </label>
          <div className="music-track-list">
            {BGM_TRACKS.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                isSelected={settings.bgmTrack === track.id}
                isPreviewing={previewingTrack?.id === track.id}
                onSelect={() => selectTrack(track.id)}
                onPreviewToggle={() => togglePreview(track)}
              />
            ))}
          </div>
        </fieldset>
        {previewingTrack !== null && (
          <div className="music-now-playing">
            <EqualizerBars />
            <span className="music-now-playing-label">{previewingTrack.label}</span>
            <button
              type="button"
              className="music-icon-button"
              data-active
              aria-label="停止试听"
              onClick={stopPreview}
            >
              <IconStopCircle aria-hidden />
            </button>
          </div>
        )}
        <VolumeSlider
          label="背景音乐音量"
          value={volumeDraft ?? settings.bgmVolume}
          onValueChange={changeVolume}
          onCommit={commitVolume}
        />
      </div>
    </section>
  );
}

function GameAudioSection({
  audioService,
  previews,
}: {
  readonly audioService: AudioService;
  readonly previews: readonly ClientGameAudioPreview[];
}) {
  const settings = useSyncExternalStore(audioSettings.subscribe, audioSettings.getSnapshot);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [previewingGameType, setPreviewingGameType] = useState<
    ClientGameAudioPreview['gameType'] | null
  >(null);
  // A fresh object per invocation, so a stopped invocation's completion cannot clear a restart.
  const activePlaybackRef = useRef<{ readonly preview: ClientGameAudioPreview } | null>(null);

  useEffect(
    () => () => {
      activePlaybackRef.current?.preview.stop();
      activePlaybackRef.current = null;
    },
    [],
  );

  const changeVolume = (value: number) => {
    setVolumeDraft(value);
    audioService.setGameAudioVolume(value);
  };

  const commitVolume = () => {
    if (volumeDraft === null) return;
    setVolumeDraft(null);
    if (!saveSetting(() => audioSettings.setGameAudioVolume(volumeDraft))) {
      audioService.setGameAudioVolume(audioSettings.getSnapshot().gameAudioVolume);
    }
  };

  const togglePreview = (preview: ClientGameAudioPreview) => {
    const activePlayback = activePlaybackRef.current;
    if (activePlayback?.preview.gameType === preview.gameType) {
      activePlayback.preview.stop();
      activePlaybackRef.current = null;
      setPreviewingGameType(null);
      return;
    }
    activePlayback?.preview.stop();
    const playback = { preview };
    activePlaybackRef.current = playback;
    setPreviewingGameType(preview.gameType);
    void preview
      .play()
      .catch((error: unknown) => {
        musicSettingsLog.warn('Game audio preview failed', { gameType: preview.gameType, error });
      })
      .finally(() => {
        if (activePlaybackRef.current !== playback) return;
        activePlaybackRef.current = null;
        setPreviewingGameType(null);
      });
  };

  return (
    <section className="settings-card">
      <h2 className="settings-card-title">
        <IconVolumeHigh aria-hidden className="music-title-icon" /> 游戏音效
      </h2>
      <VolumeSlider
        label="游戏音效音量"
        value={volumeDraft ?? settings.gameAudioVolume}
        onValueChange={changeVolume}
        onCommit={commitVolume}
      />
      {previews.map((preview) => {
        const isPreviewing = previewingGameType === preview.gameType;
        return (
          <button
            key={preview.gameType}
            type="button"
            className="music-preview-row"
            data-active={isPreviewing || undefined}
            onClick={() => togglePreview(preview)}
          >
            {isPreviewing ? <IconStopCircle aria-hidden /> : <IconPlayCircle aria-hidden />}
            <span>
              {isPreviewing
                ? `停止${preview.label}（${preview.gameLabel}）`
                : `${preview.label}（${preview.gameLabel}）`}
            </span>
          </button>
        );
      })}
    </section>
  );
}

/**
 * Music settings: background-music switch, track selection and preview, and the BGM and
 * game-audio volumes. Opened from a room (`/settings/music/:roomCode`), Back returns to that room.
 */
export function MusicSettingsPage() {
  const { roomCode } = useParams();
  const { loadAudioService } = useServices();
  const audio = useQuery({
    queryKey: ['musicSettingsAudio'],
    queryFn: async () => {
      const audioService = await loadAudioService();
      return { audioService, previews: await loadClientGameAudioPreviews(audioService) };
    },
    staleTime: Infinity,
  });
  return (
    <div className="settings-page">
      <ScreenHeader
        title="音乐设置"
        parentPath={roomCode === undefined ? '/' : roomPath(roomCode)}
        backTestId={TESTIDS.musicSettingsBack}
      />
      {audio.isPending ? (
        <LoadingScreen message="正在加载音频" />
      ) : audio.isError ? (
        <LoadingScreen error="音频加载失败，请重试" onRetry={() => void audio.refetch()} />
      ) : (
        <main className="settings-content">
          <BgmSection audioService={audio.data.audioService} />
          <GameAudioSection audioService={audio.data.audioService} previews={audio.data.previews} />
        </main>
      )}
    </div>
  );
}
