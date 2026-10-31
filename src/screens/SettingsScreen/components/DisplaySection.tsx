/**
 * DisplaySection - Display preferences card (Memoized)
 *
 * Owns the 「座位装饰」 switch: persists through SettingsService and rolls the switch back on a
 * storage failure. The room grid reads the value via `useSeatDecorationsPreference`.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { useServices } from '@/contexts/ServiceContext';
import { isExpectedStorageError } from '@/features/settings/services/SettingsService';
import { TESTIDS } from '@/testids';
import { colors, typography, withAlpha } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { settingsLog } from '@/utils/logger';

import { type SettingsScreenStyles } from './styles';

interface DisplaySectionProps {
  styles: SettingsScreenStyles;
}

/** Display section. */
export const DisplaySection = memo<DisplaySectionProps>(({ styles }) => {
  const { settingsService } = useServices();
  const [isSeatDecorationsEnabled, setIsSeatDecorationsEnabled] = useState(true);

  useEffect(() => {
    void settingsService.load().then(() => {
      setIsSeatDecorationsEnabled(settingsService.isSeatDecorationsEnabled());
    });
  }, [settingsService]);

  const handleToggle = useCallback(
    (enabled: boolean) => {
      setIsSeatDecorationsEnabled(enabled);
      settingsService.setSeatDecorationsEnabled(enabled).catch((e: unknown) => {
        setIsSeatDecorationsEnabled(settingsService.isSeatDecorationsEnabled());
        handleError(e, {
          label: '保存显示设置',
          logger: settingsLog,
          alertMessage: '设置未保存，请检查浏览器存储权限后重试',
          isExpected: isExpectedStorageError,
        });
      });
    },
    [settingsService],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        <Ionicons name="sparkles-outline" size={typography.body} color={colors.text} /> 显示
      </Text>
      <View style={styles.aboutRow}>
        <View style={styles.settingLabelColumn}>
          <Text style={styles.aboutValue}>座位装饰</Text>
          <Text style={styles.aboutLabel}>房间内的座位光效、宠物与入座动画；关闭可省电</Text>
        </View>
        <Switch
          value={isSeatDecorationsEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
          thumbColor={isSeatDecorationsEnabled ? colors.primary : colors.textSecondary}
          testID={TESTIDS.settingsSeatDecorationsSwitch}
        />
      </View>
    </View>
  );
});

DisplaySection.displayName = 'DisplaySection';
