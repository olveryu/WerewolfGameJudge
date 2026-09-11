// Fixed seven-player room creation screen for Fashion Shadow.

import {
  FASHION_ROLE_BY_ID,
  FASHION_ROLE_IDS,
  FASHION_ROUND_BY_NUMBER,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import { type RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthContext } from '@/contexts/AuthContext';
import { useRoomCreationController } from '@/features/room/controllers/useRoomCreationController';
import { replaceWithCreatedRoom } from '@/features/room/navigation/roomFlowNavigation';
import { FashionBackdrop } from '@/games/fashion-shadow/components/FashionBackdrop';
import { FashionButton as Button } from '@/games/fashion-shadow/components/FashionButton';
import { FashionHeader } from '@/games/fashion-shadow/components/FashionHeader';
import { FashionPanel } from '@/games/fashion-shadow/components/FashionPanel';
import { parseFashionConfigRouteParams } from '@/games/fashion-shadow/navigation/fashionGameNavigation';
import { FashionTutorial } from '@/games/fashion-shadow/tutorial/FashionTutorial';
import {
  hasCompletedFashionTutorial,
  markFashionTutorialCompleted,
} from '@/games/fashion-shadow/tutorial/tutorialProgress';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';
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

  const openTutorial = () => {
    if (user === null) {
      navigation.navigate('AuthLogin', {
        loginTitle: '登录后开始新手关卡',
        loginSubtitle: '完成 5 分钟训练后即可创建 7 人房间',
      });
      return;
    }
    setTutorialActive(true);
  };

  const completeTutorial = () => {
    if (user === null) {
      setTutorialActive(false);
      navigation.navigate('AuthLogin', {
        loginTitle: '登录后保存新手进度',
        loginSubtitle: '登录后重新完成训练即可解锁正式 7 人房间',
      });
      return;
    }
    markFashionTutorialCompleted(user.id);
    setTutorialCompleted(true);
    setTutorialActive(false);
  };

  useEffect(() => {
    setTutorialCompleted(user !== null && hasCompletedFashionTutorial(user.id));
  }, [user]);

  if (tutorialActive) {
    return (
      <FashionTutorial
        topInset={insets.top}
        onBack={() => setTutorialActive(false)}
        onComplete={completeTutorial}
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
      <FashionBackdrop />
      <FashionHeader
        title="时尚追凶：供应链暗影"
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <FashionPanel tone="pink">
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
            <Button variant="ghost" onPress={openTutorial}>
              重玩 5 分钟新手关卡
            </Button>
          ) : (
            <Button variant="primary" size="lg" onPress={openTutorial}>
              {user === null ? '登录后开始 5 分钟新手关卡' : '开始 5 分钟新手关卡'}
            </Button>
          )}
        </FashionPanel>

        <FashionPanel tone="cyan">
          <Text style={styles.eyebrow}>IDENTITY POOL / 身份池</Text>
          <Text style={styles.sectionTitle}>7 个身份随机分配，没有纯旁观角色</Text>
          <View style={styles.roleGrid}>
            {FASHION_ROLE_IDS.map((roleId) => {
              const role = FASHION_ROLE_BY_ID[roleId];
              return (
                <View key={roleId} style={styles.roleCard}>
                  <Text style={styles.roleName}>{role.name}</Text>
                  <Text numberOfLines={2} style={styles.roleStance}>
                    {role.publicStance}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.hint}>隐藏秘密与个人胜利条件只会在开局后向本人显示。</Text>
        </FashionPanel>

        <Text style={styles.sectionKicker}>CASE ROUTE / 四轮案件路线</Text>
        {([1, 2, 3, 4] as const).map((roundNumber) => {
          const round = FASHION_ROUND_BY_NUMBER[roundNumber];
          return (
            <View key={roundNumber} style={styles.card}>
              <View style={styles.caseMeta}>
                <Text style={styles.caseNumber}>CASE {String(roundNumber).padStart(2, '0')}</Text>
                <Text style={styles.caseEsg}>
                  {round.location} · ESG {round.esg}
                </Text>
              </View>
              <Text style={styles.sectionTitle}>{round.eventTitle}</Text>
              <Text style={styles.body}>
                潜在线索：{round.evidenceId} · {round.evidenceTitle}
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
            accessibilityLabel={
              user === null
                ? '登录并完成新手关卡后才能创建 7 人房间'
                : '完成新手关卡后才能创建 7 人房间'
            }
          >
            {user === null ? '登录并完成新手关卡后创建 7 人房间' : '完成新手关卡后创建 7 人房间'}
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: fashionShadowColors.background },
  content: { padding: spacing.screenH, gap: spacing.medium },
  card: {
    backgroundColor: fashionShadowColors.surfaceMuted,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    gap: spacing.small,
  },
  eyebrow: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
  },
  title: {
    color: fashionShadowColors.text,
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
  },
  sectionTitle: {
    color: fashionShadowColors.text,
    fontSize: typography.subtitle,
    fontWeight: typography.weights.bold,
  },
  sectionKicker: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  },
  roleCard: {
    width: '48%',
    minWidth: 0,
    borderRadius: borderRadius.medium,
    backgroundColor: fashionShadowColors.surfaceRaised,
    padding: spacing.medium,
    gap: spacing.tight,
  },
  roleName: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.bold,
  },
  roleStance: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  hint: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  caseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
  },
  caseNumber: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
  },
  caseEsg: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  body: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
  },
  footer: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.medium,
    backgroundColor: fashionShadowColors.surfaceMuted,
  },
});
