/**
 * LoginOptions — 登录方式选择（共享组件）
 *
 * Home 和 Settings 共用。显示邮箱登录 / 匿名登录按钮。
 * 渲染登录方式 UI 并上报用户选择。不 import service，不含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, ImageSourcePropType, Text, TouchableOpacity, View } from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { TESTIDS } from '@/testids';
import { fixed, typography } from '@/theme';
import { AVATAR_IMAGES, getAvatarImageByIndex } from '@/utils/avatar';

import { type LoginOptionsProps } from './types';

/** Number of avatars shown in the preview strip. */
const STRIP_COUNT = 3;

/** Evenly-spaced indices into AVATAR_IMAGES for the preview strip. */
const STRIP_INDICES: number[] = (() => {
  const step = Math.floor(AVATAR_IMAGES.length / STRIP_COUNT);
  return Array.from({ length: STRIP_COUNT }, (_, i) => i * step);
})();

export const LoginOptions = memo<LoginOptionsProps>(
  ({
    authLoading,
    title,
    subtitle,
    onEmailSignUp,
    onEmailSignIn,
    onAnonymousLogin,
    onCancel,
    styles,
  }) => {
    return (
      <View style={styles.formContainer}>
        {title != null && <Text style={styles.formTitle}>{title}</Text>}
        {subtitle != null && <Text style={styles.formSubtitle}>{subtitle}</Text>}

        {/* Avatar preview card */}
        <View style={styles.avatarStripContainer}>
          <View style={styles.avatarStripRow}>
            {STRIP_INDICES.map((avatarIdx) => (
              <Image
                key={avatarIdx}
                source={getAvatarImageByIndex(avatarIdx) as ImageSourcePropType}
                style={styles.avatarStripImage}
                resizeMode="cover"
              />
            ))}
          </View>
          <Text style={styles.avatarStripText}>{`${AVATAR_IMAGES.length} 款暗黑头像`}</Text>
        </View>

        {/* 邮箱注册 — 主按钮 */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onEmailSignUp}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={styles.primaryButtonText}>
            <Ionicons name={UI_ICONS.EMAIL} size={typography.body} />
            {' 邮箱注册'}
          </Text>
          <Text style={styles.buttonCaptionInverse}>选头像起昵称，解锁绚丽头像框</Text>
          <Text style={styles.buttonCaptionInverseMuted}>✦ 免验证，输入即注册</Text>
        </TouchableOpacity>

        {/* 邮箱登录 — 次级按钮 */}
        <TouchableOpacity
          style={styles.outlineButton}
          onPress={onEmailSignIn}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={styles.outlineButtonText}>
            <Ionicons name={UI_ICONS.EMAIL} size={typography.body} />
            {' 邮箱登录'}
          </Text>
          <Text style={styles.buttonCaption}>已有账号，回到你的专属形象</Text>
        </TouchableOpacity>

        {/* 匿名登录 */}
        <TouchableOpacity
          style={[styles.outlineButton, authLoading && styles.buttonDisabled]}
          onPress={onAnonymousLogin}
          disabled={authLoading}
          activeOpacity={fixed.activeOpacity}
          testID={TESTIDS.homeAnonLoginButton}
        >
          <Text style={styles.outlineButtonText}>
            {authLoading ? (
              '处理中…'
            ) : (
              <>
                <Ionicons name={UI_ICONS.USER} size={typography.body} />
                {' 匿名登录'}
              </>
            )}
          </Text>
          {!authLoading && <Text style={styles.buttonCaption}>仅分配线条头像和随机昵称</Text>}
        </TouchableOpacity>

        {onCancel != null && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onCancel}
            activeOpacity={fixed.activeOpacity}
          >
            <Text style={styles.secondaryButtonText}>取消</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

LoginOptions.displayName = 'LoginOptions';
