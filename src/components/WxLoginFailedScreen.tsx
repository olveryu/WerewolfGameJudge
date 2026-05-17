/**
 * WxLoginFailedScreen — 小程序登录入口页
 *
 * 在 App 层渲染（替代 splash screen）。当 claim 流程需要用户操作时显示。
 * 视觉上复用 splash screen 的狼人背景图 + 标题布局。
 * 底部显示"进入游戏"按钮 — 点击后触发 nonce claim 流程。
 * 仅在小程序 web-view 内渲染（web-only）。
 */
import { randomPick } from '@werewolf/game-engine/utils/random';
import { Image as ExpoImage } from 'expo-image';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { getOrCreateClaimNonce, wxReLaunchWithNonce } from '@/utils/miniProgram';

// Splash screen 专用色值（匹配 web/index.html 中的 splash CSS）
const SPLASH_BG = '#0a0a12';
const TEXT_WHITE = '#ffffff';
const TEXT_SHADOW = 'rgba(0, 0, 0, 0.8)';
const DIVIDER_COLOR = 'rgba(255, 255, 255, 0.3)';
const TEXT_DIM = 'rgba(255, 255, 255, 0.6)';
const TEXT_MUTED = 'rgba(255, 255, 255, 0.5)';

const SPLASH_IMAGES = [
  '/assets/pwa/web/splash-wolf-blue.webp',
  '/assets/pwa/web/splash-wolf-red.webp',
  '/assets/pwa/web/splash-wolf-gold.webp',
] as const;

const bgImage = randomPick(SPLASH_IMAGES);

export const WxLoginFailedScreen: React.FC = () => {
  const handleWechatLogin = () => {
    const nonce = getOrCreateClaimNonce();
    wxReLaunchWithNonce(nonce);
  };

  return (
    <View style={styles.container}>
      <ExpoImage source={bgImage} style={styles.bg} contentFit="cover" />
      <View style={styles.gradient} />
      <View style={styles.titleArea}>
        <Text style={styles.mainTitle}>狼 人 杀</Text>
        <View style={styles.divider} />
        <Text style={styles.subTitle}>电 子 裁 判</Text>
      </View>
      <View style={styles.bottom}>
        <Button variant="primary" onPress={handleWechatLogin}>
          进入游戏
        </Button>
        <Text style={styles.hint}>首次使用需要初始化，请稍等</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BG,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    // RN web 支持 linearGradient backgroundImage
    // @ts-expect-error -- web-only CSS property
    backgroundImage:
      'linear-gradient(to bottom, transparent, rgba(8,8,16,0.85) 70%, rgba(8,8,16,0.95))',
  },
  titleArea: {
    position: 'absolute',
    top: '52%',
    left: 0,
    right: 0,
    alignItems: 'center',
    transform: [{ translateY: '-50%' }],
  },
  mainTitle: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 10,
    color: TEXT_WHITE,
    textShadowColor: TEXT_SHADOW,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  divider: {
    width: 120,
    height: 1,
    marginVertical: 10,
    backgroundColor: DIVIDER_COLOR,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 6,
    color: TEXT_DIM,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 48,
    paddingHorizontal: 32,
    gap: 16,
    zIndex: 2,
  },
  hint: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 4,
  },
});
