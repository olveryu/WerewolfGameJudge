import { useState, useEffect, useCallback, useRef } from 'react';
import AudioService from '../services/AudioService';
import StorageService from '../services/StorageService';
import { RoleName } from '../constants/roles';

export const useAudio = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioService = useRef(AudioService.getInstance());
  const storageService = useRef(StorageService.getInstance());

  useEffect(() => {
    // Load audio preference from storage
    const loadPreference = async () => {
      const settings = await storageService.current.getSettings();
      setIsEnabled(settings.soundEnabled);
    };
    loadPreference();
  }, []);

  const toggleAudio = useCallback(async () => {
    const newValue = !isEnabled;
    setIsEnabled(newValue);
    const settings = await storageService.current.getSettings();
    await storageService.current.saveSettings({ ...settings, soundEnabled: newValue });
  }, [isEnabled]);

  const playRoleAudio = useCallback(async (role: RoleName) => {
    if (!isEnabled) return;
    setIsPlaying(true);
    await audioService.current.playRoleBeginningAudio(role);
    setIsPlaying(false);
  }, [isEnabled]);

  const playRoleEndAudio = useCallback(async (role: RoleName) => {
    if (!isEnabled) return;
    setIsPlaying(true);
    await audioService.current.playRoleEndingAudio(role);
    setIsPlaying(false);
  }, [isEnabled]);

  const playNightStart = useCallback(async () => {
    if (!isEnabled) return;
    setIsPlaying(true);
    await audioService.current.playNightAudio();
    setIsPlaying(false);
  }, [isEnabled]);

  const playNightEnd = useCallback(async () => {
    if (!isEnabled) return;
    setIsPlaying(true);
    await audioService.current.playNightEndAudio();
    setIsPlaying(false);
  }, [isEnabled]);

  const stop = useCallback(async () => {
    await audioService.current.stop();
    setIsPlaying(false);
  }, []);

  return {
    isEnabled,
    isPlaying,
    toggleAudio,
    playRoleAudio,
    playRoleEndAudio,
    playNightStart,
    playNightEnd,
    stop,
  };
};
