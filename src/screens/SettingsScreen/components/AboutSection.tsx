/**
 * AboutSection - 关于与反馈卡片（Memoized）
 *
 * 显示应用版本、GitHub 仓库链接、问题反馈入口。
 * 渲染 UI 并打开外部链接，不 import service，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';

import { APP_VERSION } from '@/config/version';
import { typography, useColors } from '@/theme';

import { SettingsScreenStyles } from './styles';

const GITHUB_URL = 'https://github.com/olveryu/WerewolfGameJudge';
const ISSUES_URL = 'https://github.com/olveryu/WerewolfGameJudge/issues';

interface AboutSectionProps {
  styles: SettingsScreenStyles;
}

export const AboutSection = memo<AboutSectionProps>(({ styles }) => {
  const colors = useColors();

  const handleOpenGitHub = useCallback(() => {
    void Linking.openURL(GITHUB_URL);
  }, []);

  const handleOpenIssues = useCallback(() => {
    void Linking.openURL(ISSUES_URL);
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

      {/* GitHub */}
      <TouchableOpacity style={styles.aboutLink} onPress={handleOpenGitHub} activeOpacity={0.6}>
        <Text style={styles.aboutLinkText}>GitHub 仓库</Text>
        <Ionicons name="open-outline" style={styles.aboutLinkIcon} />
      </TouchableOpacity>

      {/* Feedback */}
      <TouchableOpacity style={styles.aboutLink} onPress={handleOpenIssues} activeOpacity={0.6}>
        <Text style={styles.aboutLinkText}>反馈 / 报告问题</Text>
        <Ionicons name="open-outline" style={styles.aboutLinkIcon} />
      </TouchableOpacity>

      {/* WeChat contact */}
      <View style={styles.aboutRow}>
        <Text style={styles.aboutLabel}>联系微信</Text>
        <Text style={styles.aboutValue}>olveryu</Text>
      </View>
    </View>
  );
});

AboutSection.displayName = 'AboutSection';
