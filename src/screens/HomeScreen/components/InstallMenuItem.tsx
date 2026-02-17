/**
 * InstallMenuItem - PWA 安装到主屏幕菜单项 + iOS 引导 Modal
 *
 * Android/桌面 Chrome：点击直接触发系统安装弹窗。
 * iOS 浏览器（Safari / Chrome）：点击弹出引导 Modal，按浏览器类型显示对应步骤。
 * 已安装 / 不支持：不渲染。
 *
 * ✅ 允许：渲染 UI + 调用 usePWAInstall hook
 * ❌ 禁止：import service / 业务逻辑判断
 */
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { usePWAInstall } from '@/hooks/usePWAInstall';
import { type ThemeColors } from '@/theme';

import { type HomeScreenStyles } from './styles';

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
      <TouchableOpacity style={styles.footerLink} onPress={handlePress} activeOpacity={0.7}>
        <Ionicons name="download-outline" size={14} color={colors.primary} />
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
                      点击右上角 <Ionicons name="share-outline" size={16} color={colors.primary} />{' '}
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
                      <Ionicons name="share-outline" size={16} color={colors.primary} /> 分享按钮
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

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCloseGuide}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryButtonText}>我知道了</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

export const InstallMenuItem = memo(InstallMenuItemComponent);
