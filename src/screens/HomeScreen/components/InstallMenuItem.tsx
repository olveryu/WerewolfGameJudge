/**
 * InstallMenuItem - PWA "Add to Home Screen" menu item + iOS guide modal
 *
 * Android/desktop Chrome: tap triggers the system install prompt directly.
 * iOS browser (Safari / Chrome): tap opens a guide modal with browser-specific steps.
 * WeChat in-app browser: blocked by the HTML overlay (web/index.html); this component does not render.
 * Already installed / not supported: does not render.
 * Renders UI and calls usePWAInstall hook; no service imports, no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useCallback, useState } from 'react';
import { Text, TouchableOpacity, View, type ViewStyle } from 'react-native';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { componentSizes, fixed, spacing, type ThemeColors } from '@/theme';

import { type HomeScreenStyles } from './styles';

/** Layout margin only — Button owns visual styling */
const GUIDE_DISMISS_MARGIN: ViewStyle = { marginBottom: spacing.medium };

interface InstallMenuItemProps {
  styles: HomeScreenStyles;
  colors: ThemeColors;
}

const InstallMenuItemComponent: React.FC<InstallMenuItemProps> = ({ styles, colors }) => {
  const { mode, iosBrowser, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  const handlePress = useCallback(async () => {
    if (mode === 'prompt') {
      await install();
    } else if (mode === 'ios-guide') {
      setShowGuide(true);
    }
  }, [mode, install]);

  const handleCloseGuide = useCallback(() => {
    setShowGuide(false);
  }, []);

  if (mode === 'hidden') return null;

  return (
    <>
      <TouchableOpacity
        style={styles.footerLink}
        onPress={() => {
          void handlePress();
        }}
        activeOpacity={fixed.activeOpacity}
      >
        <Ionicons name="download-outline" size={componentSizes.icon.sm} color={colors.primary} />
        <Text style={styles.footerLinkText}>安装到主屏幕</Text>
      </TouchableOpacity>

      {/* iOS 浏览器引导 Modal */}
      <Modal visible={showGuide} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加到主屏幕</Text>
            <Text style={styles.modalSubtitle}>按以下步骤操作，即可像 App 一样使用</Text>

            <View style={styles.guideSteps}>
              {iosBrowser === 'chrome' ? (
                /* Chrome on iOS */
                <>
                  <View style={styles.guideStepRow}>
                    <Text style={styles.guideStepNumber}>①</Text>
                    <Text style={styles.guideStepText}>
                      点击右上角{' '}
                      <Ionicons
                        name="share-outline"
                        size={componentSizes.icon.sm}
                        color={colors.primary}
                      />{' '}
                      分享按钮
                    </Text>
                  </View>
                  <View style={styles.guideStepRow}>
                    <Text style={styles.guideStepNumber}>②</Text>
                    <Text style={styles.guideStepText}>选择「添加到主屏幕」</Text>
                  </View>
                  <View style={styles.guideStepRow}>
                    <Text style={styles.guideStepNumber}>③</Text>
                    <Text style={styles.guideStepText}>点击「添加」确认</Text>
                  </View>
                </>
              ) : (
                /* Safari (default) */
                <>
                  <View style={styles.guideStepRow}>
                    <Text style={styles.guideStepNumber}>①</Text>
                    <Text style={styles.guideStepText}>
                      点击底部工具栏的{' '}
                      <Ionicons
                        name="share-outline"
                        size={componentSizes.icon.sm}
                        color={colors.primary}
                      />{' '}
                      分享按钮
                    </Text>
                  </View>
                  <View style={styles.guideStepRow}>
                    <Text style={styles.guideStepNumber}>②</Text>
                    <Text style={styles.guideStepText}>滚动菜单，找到「添加到主屏幕」</Text>
                  </View>
                  <View style={styles.guideStepRow}>
                    <Text style={styles.guideStepNumber}>③</Text>
                    <Text style={styles.guideStepText}>点击右上角「添加」确认</Text>
                  </View>
                </>
              )}
            </View>

            <Button variant="primary" onPress={handleCloseGuide} style={GUIDE_DISMISS_MARGIN}>
              知道了
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
};

export const InstallMenuItem = memo(InstallMenuItemComponent);
