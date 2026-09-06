// Fixed seven-player room creation screen for Fashion Shadow.

import { FASHION_ROUND_BY_NUMBER } from '@game-judge/game-engine/games/fashion-shadow/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomCreationController } from '@/features/room/controllers/useRoomCreationController';
import { replaceWithCreatedRoom } from '@/features/room/navigation/roomFlowNavigation';
import { parseFashionConfigRouteParams } from '@/games/fashion-shadow/navigation/fashionGameNavigation';
import { FashionTutorial } from '@/games/fashion-shadow/tutorial/FashionTutorial';
import {
  hasCompletedFashionTutorial,
  markFashionTutorialCompleted,
} from '@/games/fashion-shadow/tutorial/tutorialProgress';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

export const FashionConfigScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'GameConfig'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GameConfig'>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { createRoom, isCreating } = useRoomCreationController();
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(
    () => user !== null && hasCompletedFashionTutorial(user.id),
  );
  parseFashionConfigRouteParams(route.params);

  useEffect(() => {
    setTutorialCompleted(user !== null && hasCompletedFashionTutorial(user.id));
  }, [user]);

  if (tutorialActive) {
    return (
      <FashionTutorial
        topInset={insets.top}
        onBack={() => setTutorialActive(false)}
        onComplete={() => {
          if (user === null) {
            throw new Error(
              '[FAIL-FAST] Fashion tutorial completion requires an authenticated user',
            );
          }
          markFashionTutorialCompleted(user.id);
          setTutorialCompleted(true);
          setTutorialActive(false);
        }}
      />
    );
  }

  const create = () => {
    if (user === null) {
      throw new Error('[FAIL-FAST] Fashion Shadow room creation requires an authenticated user');
    }
    void createRoom({
      expectedHostUserId: user.id,
      gameType: 'fashion-shadow',
      config: { numberOfPlayers: 7 },
    })
      .then((record) => replaceWithCreatedRoom(navigation, record.roomCode))
      .catch((error: unknown) => {
        handleError(error, {
          label: '创建时尚追凶房间',
          logger: configLog,
          alertMessage: '创建房间失败，请重试',
        });
      });
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenHeader
        title="时尚追凶：供应链暗影"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>
            {tutorialCompleted
              ? '新手关卡已完成 · 正式模式已解锁'
              : '首次进入 · 先完成 5 分钟新手关卡'}
          </Text>
          <Text style={styles.title}>固定 7 人 · 4 轮 ESG 推理 · 最终听证</Text>
          <Text style={styles.body}>
            7
            个角色各有公开立场、隐藏秘密和独立胜利条件。正式局开始前，新玩家先完成「永续长的抉择」单人关卡，认识
            E / S / G、吹哨者、调查证据与证据消失机制。
          </Text>
          {tutorialCompleted ? (
            <Button variant="ghost" onPress={() => setTutorialActive(true)}>
              重玩 5 分钟新手关卡
            </Button>
          ) : (
            <Button variant="primary" size="lg" onPress={() => setTutorialActive(true)}>
              开始 5 分钟新手关卡
            </Button>
          )}
        </View>
        {([1, 2, 3, 4] as const).map((roundNumber) => {
          const round = FASHION_ROUND_BY_NUMBER[roundNumber];
          return (
            <View key={roundNumber} style={styles.card}>
              <Text style={styles.sectionTitle}>
                第 {roundNumber} 轮 · {round.location} · {round.esg}
              </Text>
              <Text style={styles.body}>
                {round.eventId} {round.eventTitle}
              </Text>
              <Text style={styles.body}>
                调查结果：{round.evidenceId} {round.evidenceTitle}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}>
        {tutorialCompleted ? (
          <Button variant="primary" size="lg" onPress={create} loading={isCreating}>
            创建 7 人房间
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            disabled
            accessibilityLabel="完成新手关卡后才能创建 7 人房间"
          >
            完成新手关卡后创建 7 人房间
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenH, gap: spacing.medium },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    gap: spacing.small,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: typography.weights.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  footer: { paddingHorizontal: spacing.screenH, paddingTop: spacing.medium },
});
