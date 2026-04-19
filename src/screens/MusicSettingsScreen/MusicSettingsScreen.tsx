/**
 * MusicSettingsScreen — 音乐设置页
 *
 * 两大区域：BGM（开关+曲目选择+试听+音量） + 角色音效（开关+音量+试听）。
 * 试听与选择解耦——试听不自动切换选中曲目。
 * BGM 关闭时曲目列表保留但 disable（避免布局跳跃）。
 * 设置持久化通过 SettingsService（AsyncStorage）。
 * 试听通过 AudioService.startBgm / stopBgm。
 * 不含游戏逻辑，不 import GameFacade。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useServices } from '@/contexts/ServiceContext';
import type { RootStackParamList } from '@/navigation/types';
import type { BgmTrackSetting } from '@/services/infra/audio/audioRegistry';
import { BGM_TRACKS } from '@/services/infra/audio/audioRegistry';
import { colors, componentSizes, fixed, spacing, withAlpha } from '@/theme';
import { log } from '@/utils/logger';

import { NowPlayingBar, TrackRow, VolumeSlider } from './components';
import { createMusicSettingsStyles } from './MusicSettingsScreen.styles';

const musicSettingsLog = log.extend('MusicSettingsScreen');

export const MusicSettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createMusicSettingsStyles(colors), []);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'MusicSettings'>>();
  const { settingsService, audioService } = useServices();

  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmTrack, setBgmTrack] = useState<BgmTrackSetting>('random');
  const [bgmVolume, setBgmVolume] = useState(0.1);
  const [roleAudioVolume, setRoleAudioVolume] = useState(1.0);
  const [previewingTrack, setPreviewingTrack] = useState<string | null>(null);
  const [previewingRoleAudio, setPreviewingRoleAudio] = useState(false);

  // Track whether we started a preview so we can stop on unmount
  const previewActiveRef = useRef(false);

  // Load persisted settings
  useEffect(() => {
    settingsService
      .load()
      .then(() => {
        setBgmEnabled(settingsService.isBgmEnabled());
        setBgmTrack(settingsService.getBgmTrack());
        setBgmVolume(settingsService.getBgmVolume());
        setRoleAudioVolume(settingsService.getRoleAudioVolume());
      })
      .catch(() => {
        // defaults already set
      });
  }, [settingsService]);

  // Stop preview on unmount
  useEffect(() => {
    return () => {
      if (previewActiveRef.current) {
        audioService.stopBgm();
      }
      audioService.stop(); // stop any role audio preview
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
        musicSettingsLog.warn('Failed to persist bgmEnabled:', e);
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
    (trackId: string) => {
      const track = trackId as BgmTrackSetting;
      setBgmTrack(track);
      settingsService.setBgmTrack(track).catch((e: unknown) => {
        musicSettingsLog.warn('Failed to persist bgmTrack:', e);
      });
    },
    [settingsService],
  );

  // Preview playback (independent of selection)
  const handlePreviewToggle = useCallback(
    (trackId: string) => {
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
        const entry = BGM_TRACKS.find((t) => t.id === trackId);
        if (entry) {
          audioService.startBgm([entry.asset]).catch((e: unknown) => {
            musicSettingsLog.warn('Preview playback failed:', e);
          });
          previewActiveRef.current = true;
          setPreviewingTrack(trackId);
        }
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
        musicSettingsLog.warn('Failed to persist bgmVolume:', e);
      });
    },
    [settingsService],
  );

  // Role audio volume change (live)
  const handleRoleAudioVolumeChange = useCallback(
    (value: number) => {
      setRoleAudioVolume(value);
      audioService.setRoleAudioVolume(value);
    },
    [audioService],
  );

  // Role audio volume persist on release
  const handleRoleAudioVolumeComplete = useCallback(
    (value: number) => {
      settingsService.setRoleAudioVolume(value).catch((e: unknown) => {
        musicSettingsLog.warn('Failed to persist roleAudioVolume:', e);
      });
    },
    [settingsService],
  );

  // Role audio preview (wolf begin clip)
  const handleRoleAudioPreview = useCallback(() => {
    if (previewingRoleAudio) {
      audioService.stop();
      setPreviewingRoleAudio(false);
    } else {
      audioService
        .playRoleBeginningAudio('wolf')
        .then(() => {
          setPreviewingRoleAudio(false);
        })
        .catch(() => {
          setPreviewingRoleAudio(false);
        });
      setPreviewingRoleAudio(true);
    }
  }, [previewingRoleAudio, audioService]);

  // Resolve previewing track label for NowPlayingBar
  const previewingTrackLabel = useMemo(() => {
    if (!previewingTrack) return '';
    const entry = BGM_TRACKS.find((t) => t.id === previewingTrack);
    return entry ? entry.label : '';
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

            {/* Individual tracks */}
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

        {/* ── Section 2: Role Audio ── */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="volume-high" size={componentSizes.icon.sm} color={colors.primary} />
              <Text style={styles.sectionTitle}>角色音效</Text>
            </View>
          </View>

          <Text style={styles.volumeLabel}>音量</Text>
          <View style={styles.volumeRow}>
            <VolumeSlider
              value={roleAudioVolume}
              onValueChange={handleRoleAudioVolumeChange}
              onSlidingComplete={handleRoleAudioVolumeComplete}
              colors={colors}
            />
          </View>

          <TouchableOpacity
            style={styles.previewRow}
            onPress={handleRoleAudioPreview}
            activeOpacity={fixed.activeOpacity}
          >
            <Ionicons
              name={previewingRoleAudio ? 'stop-circle' : 'play-circle'}
              size={componentSizes.icon.lg}
              color={previewingRoleAudio ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.previewText}>{previewingRoleAudio ? '停止试听' : '试听效果'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};
