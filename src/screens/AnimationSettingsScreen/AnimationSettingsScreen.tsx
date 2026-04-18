/**
 * AnimationSettingsScreen — 翻牌动画设置页
 *
 * 展示所有可用翻牌揭示效果（卡片网格），支持选择 + 全屏预览。
 * 复用 SettingsOptionGroup / SettingsOptionCard 和 RoleRevealAnimator。
 * 设置持久化通过 SettingsService（AsyncStorage）。
 * 不含游戏逻辑，不 import GameFacade。
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { randomPick } from '@werewolf/game-engine/utils/random';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import type { RoleData } from '@/components/RoleRevealEffects';
import { createRoleData, RoleRevealAnimator } from '@/components/RoleRevealEffects';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ANIMATION_OPTIONS } from '@/components/SettingsSheet/animationOptions';
import { SettingsOptionGroup } from '@/components/SettingsSheet/SettingsOptionGroup';
import { useServices } from '@/contexts/ServiceContext';
import type { RootStackParamList } from '@/navigation/types';
import { colors, spacing, typography } from '@/theme';

import { createAnimationSettingsStyles } from './styles';

/** Mock role for preview — 预言家 */
const PREVIEW_ROLE: RoleData = createRoleData(
  'seer',
  '预言家',
  'god',
  '🔮',
  '每晚可以查验一名玩家的身份',
);

export const AnimationSettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createAnimationSettingsStyles(colors), []);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'AnimationSettings'>>();
  const route =
    useRoute<NativeStackScreenProps<RootStackParamList, 'AnimationSettings'>['route']>();
  const { settingsService } = useServices();

  const [selected, setSelected] = useState<RoleRevealAnimation>('random');
  const [showPreview, setShowPreview] = useState(false);

  // Load persisted setting
  useEffect(() => {
    settingsService
      .load()
      .then(() => {
        setSelected(settingsService.getRoleRevealAnimation());
      })
      .catch(() => {
        // defaults already set
      });
  }, [settingsService]);

  const handleSelect = useCallback(
    (value: string) => {
      const anim = value as RoleRevealAnimation;
      setSelected(anim);
      settingsService.setRoleRevealAnimation(anim).catch(() => {
        // save failure is logged by SettingsService
      });
    },
    [settingsService],
  );

  const handleGoBack = useCallback(() => {
    if (route.params?.roomNumber) {
      navigation.popTo('Room', {
        roomNumber: route.params.roomNumber,
        isHost: true,
        roleRevealAnimation: selected,
      });
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, route.params?.roomNumber, selected]);

  const handlePreview = useCallback(() => {
    setShowPreview(true);
  }, []);

  const handlePreviewComplete = useCallback(() => {
    setShowPreview(false);
  }, []);

  // Resolve actual effect type for preview (random → pick one)
  const previewEffectType = useMemo(() => {
    if (selected === 'random') {
      const effects = ANIMATION_OPTIONS.filter(
        (o): o is typeof o & { isRandom?: never; isNone?: never } =>
          !('isRandom' in o) && !('isNone' in o),
      );
      const pick = randomPick(effects);
      return pick.value as RoleRevealAnimation;
    }
    return selected;
  }, [selected, showPreview]); // eslint-disable-line react-hooks/exhaustive-deps -- re-pick on each preview open

  const canPreview = selected !== 'none';

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader
        title="翻牌动画"
        onBack={handleGoBack}
        topInset={insets.top}
        backTestID="anim-settings-back"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          !canPreview && insets.bottom > 0 && { paddingBottom: insets.bottom + spacing.screenH },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsOptionGroup
          label="选择效果"
          options={ANIMATION_OPTIONS}
          selectedValue={selected}
          onSelect={handleSelect}
          testIDPrefix="anim-settings"
        />
      </ScrollView>

      {canPreview && (
        <View
          style={[styles.previewContainer, insets.bottom > 0 && { paddingBottom: insets.bottom }]}
        >
          <Button
            variant="ghost"
            buttonColor={colors.surface}
            textColor={colors.primary}
            onPress={handlePreview}
            style={styles.previewButton}
            icon={<Ionicons name="play" size={typography.body} color={colors.primary} />}
          >
            预览当前效果
          </Button>
        </View>
      )}

      {/* Full-screen preview modal */}
      {showPreview && selected !== 'none' && (
        <RoleRevealAnimator
          visible={showPreview}
          effectType={previewEffectType as Exclude<RoleRevealAnimation, 'none' | 'random'>}
          role={PREVIEW_ROLE}
          onComplete={handlePreviewComplete}
          enableHaptics
        />
      )}
    </SafeAreaView>
  );
};
