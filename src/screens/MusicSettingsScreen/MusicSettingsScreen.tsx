/**
 * MusicSettingsScreen — music settings page
 *
 * Two main sections: BGM controls and game-owned foreground audio controls.
 * Preview is decoupled from selection — previewing does not auto-switch the selected track.
 * When BGM is off the track list remains visible but disabled (avoids layout jumps).
 * Settings are persisted via SettingsService (AsyncStorage).
 * Preview goes through AudioService.startBgm / stopBgm.
 * Game-specific previews enter through the client game catalog contribution.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useServices } from '@/contexts/ServiceContext';
import type { BgmTrackId, BgmTrackSetting } from '@/features/product/model/BgmCatalog';
import { BGM_TRACKS, BGM_VOLUME, getBgmTrack } from '@/features/product/model/BgmCatalog';
import type { ClientGameAudioPreview } from '@/games/audioPreviews';
import { useClientGameAudioPreviews } from '@/games/ClientGameCatalogContext';
import type { RootStackParamList } from '@/navigation/types';
import { colors, componentSizes, fixed, spacing, withAlpha } from '@/theme';
import { log } from '@/utils/logger';

import { NowPlayingBar, TrackRow, VolumeSlider } from './components';
import { createMusicSettingsStyles } from './MusicSettingsScreen.styles';

const musicSettingsLog = log.extend('MusicSettingsScreen');

interface ActiveGameAudioPreview {
  readonly preview: ClientGameAudioPreview;
}

/** Music settings screen. */
export const MusicSettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createMusicSettingsStyles(colors), []);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'MusicSettings'>>();
  const { settingsService, audioService } = useServices();
  const gameAudioPreviews = useClientGameAudioPreviews();

  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmTrack, setBgmTrack] = useState<BgmTrackSetting>('random');
  const [bgmVolume, setBgmVolume] = useState(BGM_VOLUME);
  const [gameAudioVolume, setGameAudioVolume] = useState(1.0);
  const [previewingTrack, setPreviewingTrack] = useState<BgmTrackId | null>(null);
  const [previewingGameAudio, setPreviewingGameAudio] = useState<
    ClientGameAudioPreview['gameType'] | null
  >(null);

  // Track whether we started a preview so we can stop on unmount
  const previewActiveRef = useRef(false);
  const activeGameAudioPreviewRef = useRef<ActiveGameAudioPreview | null>(null);

  // Load persisted settings
  useEffect(() => {
    void settingsService.load().then(() => {
      setBgmEnabled(settingsService.isBgmEnabled());
      setBgmTrack(settingsService.getBgmTrack());
      setBgmVolume(settingsService.getBgmVolume());
      setGameAudioVolume(settingsService.getGameAudioVolume());
    });
  }, [settingsService]);

  // Stop preview on unmount
  useEffect(() => {
    return () => {
      if (previewActiveRef.current) {
        audioService.stopBgm();
      }
      activeGameAudioPreviewRef.current?.preview.stop();
      activeGameAudioPreviewRef.current = null;
    };
  }, [audioService]);

  const handleGoBack = useCallback(() => {
    if (previewActiveRef.current) {
      audioService.stopBgm();
      previewActiveRef.current = false;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, audioService]);

  // BGM toggle
  const handleBgmToggle = useCallback(
    (enabled: boolean) => {
      setBgmEnabled(enabled);
      settingsService.setBgmEnabled(enabled).catch((e: unknown) => {
        musicSettingsLog.warn('Failed to persist bgmEnabled', e);
      });
      if (!enabled && previewActiveRef.current) {
        audioService.stopBgm();
        previewActiveRef.current = false;
        setPreviewingTrack(null);
      }
    },
    [settingsService, audioService],
  );

  // Track selection (does NOT stop preview — selection and preview are independent)
  const handleTrackSelect = useCallback(
    (track: BgmTrackSetting) => {
      setBgmTrack(track);
      settingsService.setBgmTrack(track).catch((e: unknown) => {
        musicSettingsLog.warn('Failed to persist bgmTrack', e);
      });
    },
    [settingsService],
  );

  // Preview playback (independent of selection)
  const handlePreviewToggle = useCallback(
    (trackId: BgmTrackId) => {
      if (previewingTrack === trackId) {
        // Stop preview
        audioService.stopBgm();
        previewActiveRef.current = false;
        setPreviewingTrack(null);
      } else {
        // Stop any existing preview first
        if (previewActiveRef.current) {
          audioService.stopBgm();
        }
        const entry = getBgmTrack(trackId);
        audioService.startBgm([entry.asset]).catch((e: unknown) => {
          musicSettingsLog.warn('Preview playback failed', e);
        });
        previewActiveRef.current = true;
        setPreviewingTrack(trackId);
      }
    },
    [previewingTrack, audioService],
  );

  // Stop current preview (used by NowPlayingBar)
  const handleStopPreview = useCallback(() => {
    audioService.stopBgm();
    previewActiveRef.current = false;
    setPreviewingTrack(null);
  }, [audioService]);

  // Volume change (live — applies immediately)
  const handleVolumeChange = useCallback(
    (value: number) => {
      setBgmVolume(value);
      audioService.setBgmVolume(value);
    },
    [audioService],
  );

  // Volume persist on release
  const handleVolumeComplete = useCallback(
    (value: number) => {
      settingsService.setBgmVolume(value).catch((e: unknown) => {
        musicSettingsLog.warn('Failed to persist bgmVolume', e);
      });
    },
    [settingsService],
  );

  // Foreground game audio volume change (live)
  const handleGameAudioVolumeChange = useCallback(
    (value: number) => {
      setGameAudioVolume(value);
      audioService.setGameAudioVolume(value);
    },
    [audioService],
  );

  // Foreground game audio volume persist on release
  const handleGameAudioVolumeComplete = useCallback(
    (value: number) => {
      settingsService.setGameAudioVolume(value).catch((e: unknown) => {
        musicSettingsLog.warn('Failed to persist gameAudioVolume', e);
      });
    },
    [settingsService],
  );

  const handleGameAudioPreview = useCallback((preview: ClientGameAudioPreview) => {
    const activePlayback = activeGameAudioPreviewRef.current;
    if (activePlayback?.preview.gameType === preview.gameType) {
      activePlayback.preview.stop();
      activeGameAudioPreviewRef.current = null;
      setPreviewingGameAudio(null);
      return;
    }

    activePlayback?.preview.stop();
    const playback: ActiveGameAudioPreview = { preview };
    activeGameAudioPreviewRef.current = playback;
    setPreviewingGameAudio(preview.gameType);
    void preview
      .play()
      .catch((error: unknown) => {
        musicSettingsLog.warn('Game audio preview failed', {
          gameType: preview.gameType,
          error,
        });
      })
      .finally(() => {
        if (activeGameAudioPreviewRef.current !== playback) return;
        activeGameAudioPreviewRef.current = null;
        setPreviewingGameAudio(null);
      });
  }, []);

  // Resolve previewing track label for NowPlayingBar
  const previewingTrackLabel = useMemo(() => {
    if (!previewingTrack) return '';
    return getBgmTrack(previewingTrack).label;
  }, [previewingTrack]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader
        title="音乐设置"
        onBack={handleGoBack}
        topInset={insets.top}
        backTestID="music-settings-back"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          insets.bottom > 0 && { paddingBottom: insets.bottom + spacing.screenH },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: BGM ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="musical-notes" size={componentSizes.icon.sm} color={colors.primary} />
              <Text style={styles.sectionTitle}>背景音乐</Text>
            </View>
            <Switch
              value={bgmEnabled}
              onValueChange={handleBgmToggle}
              trackColor={{
                false: colors.border,
                true: withAlpha(colors.primary, 0.4),
              }}
              thumbColor={bgmEnabled ? colors.primary : colors.textSecondary}
            />
          </View>

          {/* Track list — stays visible but disabled when BGM off */}
          <View style={!bgmEnabled ? styles.disabledOverlay : undefined}>
            {/* Random option */}
            <TouchableOpacity
              style={styles.randomRow}
              onPress={() => handleTrackSelect('random')}
              activeOpacity={fixed.activeOpacity}
              disabled={!bgmEnabled}
            >
              <View style={[styles.radioOuter, bgmTrack === 'random' && styles.radioOuterSelected]}>
                {bgmTrack === 'random' && <View style={styles.radioInner} />}
              </View>
              <Ionicons
                name="shuffle"
                size={componentSizes.icon.sm}
                color={bgmTrack === 'random' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[styles.randomLabel, bgmTrack === 'random' && styles.randomLabelSelected]}
              >
                随机播放
              </Text>
            </TouchableOpacity>

            {/* Individual tracks — fixed-height scroll viewport keeps the card compact */}
            <ScrollView
              style={styles.trackListScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {BGM_TRACKS.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  isSelected={bgmTrack === track.id}
                  isPreviewing={previewingTrack === track.id}
                  disabled={!bgmEnabled}
                  onSelect={handleTrackSelect}
                  onPreviewToggle={handlePreviewToggle}
                  colors={colors}
                />
              ))}
            </ScrollView>

            {/* Now Playing Bar — visible only when previewing */}
            {previewingTrack !== null && (
              <NowPlayingBar
                trackLabel={previewingTrackLabel}
                onStop={handleStopPreview}
                colors={colors}
              />
            )}

            {/* Volume */}
            <View style={styles.volumeSection}>
              <Text style={styles.volumeLabel}>音量</Text>
              <View style={styles.volumeRow}>
                <VolumeSlider
                  value={bgmVolume}
                  onValueChange={handleVolumeChange}
                  onSlidingComplete={handleVolumeComplete}
                  colors={colors}
                />
              </View>
            </View>
          </View>
        </View>

        {/* ── Section 2: Game Audio ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="volume-high" size={componentSizes.icon.sm} color={colors.primary} />
              <Text style={styles.sectionTitle}>游戏音效</Text>
            </View>
          </View>

          <Text style={styles.volumeLabel}>音量</Text>
          <View style={styles.volumeRow}>
            <VolumeSlider
              value={gameAudioVolume}
              onValueChange={handleGameAudioVolumeChange}
              onSlidingComplete={handleGameAudioVolumeComplete}
              colors={colors}
            />
          </View>

          {gameAudioPreviews.map((preview) => {
            const isPreviewing = previewingGameAudio === preview.gameType;
            return (
              <TouchableOpacity
                key={preview.gameType}
                style={styles.previewRow}
                onPress={() => handleGameAudioPreview(preview)}
                activeOpacity={fixed.activeOpacity}
              >
                <Ionicons
                  name={isPreviewing ? 'stop-circle' : 'play-circle'}
                  size={componentSizes.icon.lg}
                  color={isPreviewing ? colors.primary : colors.textSecondary}
                />
                <Text style={styles.previewText}>{isPreviewing ? '停止试听' : preview.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};
