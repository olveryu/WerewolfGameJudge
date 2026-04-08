/**
 * MusicSettingsScreen — 音乐设置页
 *
 * BGM 开关、曲目选择（附试听）、音量滑块。
 * 设置持久化通过 SettingsService（AsyncStorage）。
 * 试听通过 AudioService.startBgm / stopBgm。
 * 不含游戏逻辑，不 import GameFacade。
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useServices } from '@/contexts/ServiceContext';
import type { RootStackParamList } from '@/navigation/types';
import type { BgmTrackSetting } from '@/services/infra/audio/audioRegistry';
import { BGM_TRACKS } from '@/services/infra/audio/audioRegistry';
import { componentSizes, fixed, spacing, useColors, withAlpha } from '@/theme';
import { log } from '@/utils/logger';

import { VolumeSlider } from './components/VolumeSlider';
import { createMusicSettingsStyles } from './styles';

const musicSettingsLog = log.extend('MusicSettingsScreen');

export const MusicSettingsScreen: React.FC = () => {
  const colors = useColors();
  const styles = useMemo(() => createMusicSettingsStyles(colors), [colors]);
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

  // Track selection
  const handleTrackSelect = useCallback(
    (track: BgmTrackSetting) => {
      setBgmTrack(track);
      settingsService.setBgmTrack(track).catch((e: unknown) => {
        musicSettingsLog.warn('Failed to persist bgmTrack:', e);
      });
      // Stop preview when changing selection
      if (previewActiveRef.current) {
        audioService.stopBgm();
        previewActiveRef.current = false;
        setPreviewingTrack(null);
      }
    },
    [settingsService, audioService],
  );

  // Preview playback
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button variant="icon" onPress={handleGoBack} testID="music-settings-back">
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>音乐设置</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* BGM Toggle */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>背景音乐</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>BGM</Text>
            <View style={styles.chipWrap}>
              <TouchableOpacity
                style={[styles.chip, bgmEnabled && styles.chipSelected]}
                onPress={() => handleBgmToggle(true)}
                activeOpacity={fixed.activeOpacity}
              >
                <Text style={[styles.chipText, bgmEnabled && styles.chipTextSelected]}>开</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, !bgmEnabled && styles.chipSelected]}
                onPress={() => handleBgmToggle(false)}
                activeOpacity={fixed.activeOpacity}
              >
                <Text style={[styles.chipText, !bgmEnabled && styles.chipTextSelected]}>关</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Track Selection — only visible when BGM enabled */}
        {bgmEnabled && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>曲目选择</Text>

            {/* Random option */}
            <TouchableOpacity
              style={[
                styles.trackRow,
                bgmTrack === 'random' && {
                  backgroundColor: withAlpha(colors.primary, 0.12),
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => handleTrackSelect('random')}
              activeOpacity={fixed.activeOpacity}
            >
              <View style={styles.trackInfo}>
                <Text
                  style={[styles.trackLabel, bgmTrack === 'random' && styles.trackLabelSelected]}
                >
                  🎲 随机播放
                </Text>
              </View>
            </TouchableOpacity>

            {/* Individual tracks */}
            {BGM_TRACKS.map((track) => {
              const isSelected = bgmTrack === track.id;
              const isPreviewing = previewingTrack === track.id;

              return (
                <TouchableOpacity
                  key={track.id}
                  style={[
                    styles.trackRow,
                    isSelected && {
                      backgroundColor: withAlpha(colors.primary, 0.12),
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => handleTrackSelect(track.id)}
                  activeOpacity={fixed.activeOpacity}
                >
                  <View style={styles.trackInfo}>
                    <Text style={[styles.trackLabel, isSelected && styles.trackLabelSelected]}>
                      {track.label}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => handlePreviewToggle(track.id)}
                    hitSlop={{
                      top: spacing.small,
                      bottom: spacing.small,
                      left: spacing.small,
                      right: spacing.small,
                    }}
                    activeOpacity={fixed.activeOpacity}
                  >
                    <Ionicons
                      name={isPreviewing ? 'stop-circle' : 'play-circle'}
                      size={componentSizes.icon.lg}
                      color={isPreviewing ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Volume */}
        {bgmEnabled && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>背景音乐音量</Text>
            <View style={styles.volumeRow}>
              <VolumeSlider
                value={bgmVolume}
                onValueChange={handleVolumeChange}
                onSlidingComplete={handleVolumeComplete}
                colors={colors}
              />
            </View>
          </View>
        )}

        {/* Role Audio Volume — always visible */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>角色音效音量</Text>
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
