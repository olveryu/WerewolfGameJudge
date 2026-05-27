/**
 * AboutSection - About card (Memoized)
 *
 * Displays app version and contact information.
 * Renders UI only, no service imports, no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { toast } from 'sonner-native';

import { DEVELOPER_WECHAT_ID } from '@/config/announcements';
import { APP_VERSION } from '@/config/version';
import { colors, componentSizes, typography } from '@/theme';

import { type SettingsScreenStyles } from './styles';

interface AboutSectionProps {
  styles: SettingsScreenStyles;
}

/** About section. */
export const AboutSection = memo<AboutSectionProps>(({ styles }) => {
  const handleCopyWechat = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(DEVELOPER_WECHAT_ID);
      toast.success('已复制微信号');
    }
  }, []);

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
        <View style={styles.aboutValueRow}>
          <Text style={styles.aboutValue}>{DEVELOPER_WECHAT_ID}</Text>
          <Pressable onPress={handleCopyWechat} hitSlop={8}>
            <Ionicons name="copy-outline" size={componentSizes.icon.sm} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

AboutSection.displayName = 'AboutSection';
