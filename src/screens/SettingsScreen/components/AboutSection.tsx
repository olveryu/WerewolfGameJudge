/**
 * AboutSection - 关于卡片（Memoized）
 *
 * 显示应用版本与联系方式。
 * 渲染 UI，不 import service，不包含业务逻辑判断。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Text, View } from 'react-native';

import { APP_VERSION } from '@/config/version';
import { colors, typography } from '@/theme';

import { SettingsScreenStyles } from './styles';

interface AboutSectionProps {
  styles: SettingsScreenStyles;
}

export const AboutSection = memo<AboutSectionProps>(({ styles }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        <Ionicons name="information-circle-outline" size={typography.body} color={colors.text} />{' '}
        关于
      </Text>

      {/* Version */}
      <View style={styles.aboutRow}>
        <Text style={styles.aboutLabel}>版本</Text>
        <Text style={styles.aboutValue}>{APP_VERSION}</Text>
      </View>

      {/* WeChat contact */}
      <View style={styles.aboutRow}>
        <Text style={styles.aboutLabel}>联系微信</Text>
        <Text style={styles.aboutValue}>olveryu</Text>
      </View>
    </View>
  );
});

AboutSection.displayName = 'AboutSection';
