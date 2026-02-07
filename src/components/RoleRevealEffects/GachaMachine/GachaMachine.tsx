/**
 * GachaMachine - 复古日式扭蛋机揭示效果
 *
 * 特点：圆形透明球体顶部、投币口、旋转手柄、扭蛋滚出。
 *
 * ✅ 允许：渲染动画 + 触觉反馈
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Animated, StyleSheet, Pressable, Text, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius } from '../../../theme';
import type { RoleRevealEffectProps } from '../types';
import { ALIGNMENT_THEMES } from '../types';
import { CONFIG } from '../config';
import { canUseNativeDriver } from '../utils/platform';
import { triggerHaptic } from '../utils/haptics';
import { RoleCardContent } from '../common/RoleCardContent';
import { GlowBorder } from '../common/GlowBorder';
import type { RoleId } from '../../../models/roles';

const CAPSULE_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#95E1D3',
  '#DDA0DD',
  '#87CEEB',
  '#F0E68C',
];

// 圆形透明球内的小扭蛋
const TinyCapsule: React.FC<{ angle: number; distance: number; color: string; size: number }> =
  React.memo(({ angle, distance, color, size }) => {
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance + 10;
    return (
      <View
        style={[
          styles.tinyCapsule,
          {
            left: 75 + x - size / 2,
            top: 75 + y - size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      >
        <View style={[styles.tinyCapsuleShine, { width: size * 0.3, height: size * 0.3 }]} />
      </View>
    );
  });
TinyCapsule.displayName = 'TinyCapsule';

export const GachaMachine: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'gacha-machine',
}) => {
  const theme = ALIGNMENT_THEMES[role.alignment];
  const config = CONFIG.gachaMachine ?? { revealHoldDuration: 1500 };

  const [phase, setPhase] = useState<
    'ready' | 'spinning' | 'dropping' | 'waiting' | 'opening' | 'revealed'
  >('ready');
  const onCompleteCalledRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cardWidth = 260;
  const cardHeight = 364;

  // 动画值
  const dialRotation = useMemo(() => new Animated.Value(0), []);
  const capsuleY = useMemo(() => new Animated.Value(-30), []);
  const capsuleOpacity = useMemo(() => new Animated.Value(0), []);
  const capsuleRotate = useMemo(() => new Animated.Value(0), []);
  const shellScale = useMemo(() => new Animated.Value(1), []);
  const shellOpacity = useMemo(() => new Animated.Value(1), []);
  const cardScale = useMemo(() => new Animated.Value(0), []);
  const cardOpacity = useMemo(() => new Animated.Value(0), []);
  const bobble = useMemo(() => new Animated.Value(0), []);

  // 随机小扭蛋位置 — lazy initializer avoids Math.random() on re-render
  const [tinyCapsules] = useState(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      result.push({
        id: i,
        angle: ((Math.PI * 2) / 12) * i + Math.random() * 0.5,
        distance: 25 + Math.random() * 35,
        color: CAPSULE_COLORS[Math.floor(Math.random() * CAPSULE_COLORS.length)],
        size: 14 + Math.random() * 10,
      });
    }
    return result;
  });

  const cleanup = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  useEffect(() => cleanup, [cleanup]);

  // 小球轻微晃动
  useEffect(() => {
    if (phase === 'ready') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(bobble, {
            toValue: 3,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(bobble, {
            toValue: -3,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
  }, [phase, bobble]);

  const handleGlowComplete = useCallback(() => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    const t = setTimeout(() => onComplete(), config.revealHoldDuration ?? 1200);
    timersRef.current.push(t);
  }, [onComplete, config.revealHoldDuration]);

  // 旋转手柄 → 扭蛋掉落
  const spinDial = useCallback(() => {
    if (phase !== 'ready') return;
    setPhase('spinning');
    if (enableHaptics) triggerHaptic('medium', true);

    Animated.timing(dialRotation, {
      toValue: 360,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: canUseNativeDriver,
    }).start(() => {
      setPhase('dropping');
      capsuleOpacity.setValue(1);

      Animated.parallel([
        Animated.timing(capsuleY, {
          toValue: 200,
          duration: 800,
          easing: Easing.bounce,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(capsuleRotate, {
          toValue: 540,
          duration: 800,
          useNativeDriver: canUseNativeDriver,
        }),
      ]).start(() => setPhase('waiting'));
    });
  }, [phase, dialRotation, capsuleY, capsuleOpacity, capsuleRotate, enableHaptics]);

  // 打开扭蛋
  const openCapsule = useCallback(() => {
    if (phase !== 'waiting') return;
    setPhase('opening');
    if (enableHaptics) triggerHaptic('heavy', true);

    Animated.parallel([
      Animated.timing(shellScale, {
        toValue: 1.3,
        duration: 250,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.timing(shellOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: canUseNativeDriver,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(cardScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: canUseNativeDriver,
        }),
      ]),
    ]).start(() => setPhase('revealed'));
  }, [phase, shellScale, shellOpacity, cardScale, cardOpacity, enableHaptics]);

  useEffect(() => {
    if (reducedMotion) {
      cardScale.setValue(1);
      cardOpacity.setValue(1);
      shellOpacity.setValue(0);
      setPhase('revealed');
    }
  }, [reducedMotion, cardScale, cardOpacity, shellOpacity]);

  const dialRotateZ = dialRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });
  const capsuleRotateZ = capsuleRotate.interpolate({
    inputRange: [0, 540],
    outputRange: ['0deg', '540deg'],
  });

  return (
    <View testID={`${testIDPrefix}-container`} style={styles.container}>
      <LinearGradient colors={['#FFF5E6', '#FFE4CC', '#FFF5E6']} style={StyleSheet.absoluteFill} />

      {/* 扭蛋机 */}
      {phase !== 'revealed' && (
        <View style={styles.machine}>
          {/* 圆形透明球顶 */}
          <Animated.View style={[styles.dome, { transform: [{ translateY: bobble }] }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.9)', 'rgba(200,220,255,0.6)', 'rgba(255,255,255,0.8)']}
              style={styles.domeGradient}
            />
            {tinyCapsules.map((c) => (
              <TinyCapsule
                key={c.id}
                angle={c.angle}
                distance={c.distance}
                color={c.color}
                size={c.size}
              />
            ))}
            <View style={styles.domeHighlight} />
          </Animated.View>

          {/* 机身 */}
          <View style={styles.body}>
            <LinearGradient
              colors={['#FF7F7F', '#FF6B6B', '#E55555']}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.coinSlot}>
              <View style={styles.coinSlotInner} />
            </View>

            <View style={styles.label}>
              <Text style={styles.labelText}>GACHA</Text>
            </View>

            <View style={styles.outlet}>
              <View style={styles.outletInner} />
            </View>
          </View>

          {/* 旋转手柄 */}
          <Pressable onPress={spinDial} style={styles.dialContainer}>
            <Animated.View style={[styles.dial, { transform: [{ rotate: dialRotateZ }] }]}>
              <View style={styles.dialCenter} />
              <View style={styles.dialArm} />
              <View style={styles.dialKnob} />
            </Animated.View>
          </Pressable>

          {/* 底座 */}
          <View style={styles.base}>
            <LinearGradient colors={['#666', '#444', '#333']} style={StyleSheet.absoluteFill} />
          </View>
        </View>
      )}

      {/* 提示 */}
      {phase === 'ready' && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>🎯 点击转盘抽蛋!</Text>
        </View>
      )}
      {phase === 'waiting' && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>✨ 点击扭蛋打开!</Text>
        </View>
      )}

      {/* 掉落的扭蛋 */}
      {(phase === 'dropping' || phase === 'waiting' || phase === 'opening') && (
        <Animated.View
          style={[
            styles.capsule,
            {
              opacity: Animated.multiply(capsuleOpacity, shellOpacity),
              transform: [
                { translateY: capsuleY },
                { scale: shellScale },
                { rotate: capsuleRotateZ },
              ],
            },
          ]}
        >
          <Pressable onPress={openCapsule} style={styles.capsuleTouch}>
            <View style={styles.capsuleTop}>
              <View style={styles.capsuleTopShine} />
            </View>
            <View style={styles.capsuleBottom} />
            <View style={styles.capsuleRing} />
          </Pressable>
        </Animated.View>
      )}

      {/* 角色卡 */}
      {(phase === 'opening' || phase === 'revealed') && (
        <Animated.View
          style={[styles.cardWrapper, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
        >
          <RoleCardContent roleId={role.id as RoleId} width={cardWidth} height={cardHeight} />
          {phase === 'revealed' && (
            <GlowBorder
              width={cardWidth + 8}
              height={cardHeight + 8}
              color={theme.primaryColor}
              glowColor={theme.glowColor}
              borderWidth={3}
              borderRadius={borderRadius.medium + 4}
              animate={!reducedMotion}
              flashCount={3}
              flashDuration={200}
              onComplete={handleGlowComplete}
              style={styles.glowBorder}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  machine: { alignItems: 'center' },

  dome: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  domeGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 75 },
  domeHighlight: {
    position: 'absolute',
    top: 15,
    left: 20,
    width: 40,
    height: 25,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    transform: [{ rotate: '-30deg' }],
  },
  tinyCapsule: { position: 'absolute' },
  tinyCapsuleShine: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 10,
  },

  body: {
    width: 160,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: -10,
    alignItems: 'center',
  },
  coinSlot: {
    marginTop: 12,
    width: 50,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinSlotInner: { width: 30, height: 3, backgroundColor: '#111', borderRadius: 2 },
  label: {
    marginTop: 8,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  labelText: { fontSize: 14, fontWeight: '900', color: '#FF6B6B', letterSpacing: 2 },
  outlet: {
    position: 'absolute',
    bottom: 10,
    width: 60,
    height: 35,
    backgroundColor: '#222',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outletInner: { width: 50, height: 25, backgroundColor: '#111', borderRadius: 6 },

  dialContainer: { position: 'absolute', right: -50, top: 160, width: 60, height: 60 },
  dial: { width: 60, height: 60, justifyContent: 'center', alignItems: 'center' },
  dialCenter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFD700',
    borderWidth: 3,
    borderColor: '#DAA520',
  },
  dialArm: {
    position: 'absolute',
    width: 8,
    height: 35,
    backgroundColor: '#888',
    borderRadius: 4,
    top: -5,
  },
  dialKnob: {
    position: 'absolute',
    top: -15,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E74C3C',
    borderWidth: 2,
    borderColor: '#C0392B',
  },

  base: {
    width: 180,
    height: 25,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
  },

  hint: { position: 'absolute', bottom: 80 },
  hintText: { fontSize: 22, fontWeight: '700', color: '#D35400' },

  capsule: { position: 'absolute', width: 80, height: 80 },
  capsuleTouch: { width: '100%', height: '100%' },
  capsuleTop: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: '52%',
    backgroundColor: '#FF69B4',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  capsuleTopShine: {
    position: 'absolute',
    top: 8,
    left: 15,
    width: 20,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 10,
  },
  capsuleBottom: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '52%',
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
  },
  capsuleRing: {
    position: 'absolute',
    top: '46%',
    width: '100%',
    height: 8,
    backgroundColor: '#EEE',
    borderWidth: 1,
    borderColor: '#DDD',
  },

  cardWrapper: { alignItems: 'center', justifyContent: 'center' },
  glowBorder: { position: 'absolute', top: -4, left: -4 },
});
