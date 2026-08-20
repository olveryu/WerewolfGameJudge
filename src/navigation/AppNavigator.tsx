/**
 * AppNavigator - Root navigation stack for the app
 *
 * Registers product screens and game-neutral host routes selected by canonical game type.
 * URL ↔ navigation state two-way sync via `linking` config (restores page on Web refresh).
 * Covers navigator definition, screen registration, header style config, and linking route mapping.
 * No business logic; does not call services directly.
 */
import { parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import {
  getPathFromState as defaultGetPathFromState,
  getStateFromPath as defaultGetStateFromPath,
  type LinkingOptions,
  NavigationContainer,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type React from 'react';
import { useCallback } from 'react';

import { reactNavigationIntegration } from '@/app/sentryIntegrations';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SITE_URL } from '@/config/api';
import type { GameNavigationRouteKind } from '@/features/navigation/model/GameNavigationContribution';
import { parseRouteParams } from '@/features/navigation/model/routeParams';
import { RoomResolverScreen } from '@/features/room/screens/RoomResolverScreen';
import { useClientGameCatalog } from '@/games/ClientGameCatalogContext';
import { getClientGameModule } from '@/games/model/ClientGameCatalog';
import { getGameNavigationRoomCode } from '@/games/navigation';
import { AdminScreen } from '@/screens/AdminScreen/AdminScreen';
import { AppearanceScreen } from '@/screens/AppearanceScreen/AppearanceScreen';
import { AuthEmailScreen } from '@/screens/AuthScreen/AuthEmailScreen';
import { AuthForgotPasswordScreen } from '@/screens/AuthScreen/AuthForgotPasswordScreen';
import { AuthLoginScreen } from '@/screens/AuthScreen/AuthLoginScreen';
import { AuthResetPasswordScreen } from '@/screens/AuthScreen/AuthResetPasswordScreen';
import { GachaScreen } from '@/screens/GachaScreen/GachaScreen';
import { HomeScreen } from '@/screens/HomeScreen/HomeScreen';
import { MusicSettingsScreen } from '@/screens/MusicSettingsScreen/MusicSettingsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen/SettingsScreen';
import { ShardExchangeScreen } from '@/screens/ShardExchangeScreen/ShardExchangeScreen';
import { UnlocksScreen } from '@/screens/UnlocksScreen/UnlocksScreen';
import { colors } from '@/theme';
import { log } from '@/utils/logger';

import { GameConfigHostRoute, GameGuideHostRoute, GameNotepadHostRoute } from './GameHostRoutes';
import { navigationRef } from './navigationRef';
import { type RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navLog = log.extend('AppNavigator');

/**
 * URL ↔ Screen mapping. Navigates to the correct page on refresh or direct URL access.
 *
 * | Screen   | URL                            |
 * |----------|--------------------------------|
 * | Home     | `/`                            |
 * | Config   | `/game/:gameType/config/:mode` |
 * | Room     | `/room/:roomCode`             |
 * | Settings | `/settings`                    |
 *
 * Programmatic entry intent is stripped from the URL.
 */

/** Params that are programmatic-only and should never appear in the URL. */
const TRANSIENT_PARAMS = ['entryReason'];

const RoomResolverRoute: React.FC<NativeStackScreenProps<RootStackParamList, 'Room'>> = (props) => {
  const catalog = useClientGameCatalog();
  const resolveGameModule = useCallback(
    (gameType: Parameters<typeof getClientGameModule>[1]) => getClientGameModule(catalog, gameType),
    [catalog],
  );
  return <RoomResolverScreen {...props} getGameModule={resolveGameModule} />;
};

function getOptionalRoomCode(params: unknown): string | null {
  if (params === undefined) return null;
  const roomCode = parseRouteParams(params, 'Navigation').roomCode;
  return roomCode === undefined ? null : parseRoomCode(roomCode);
}

function getGameNavigationRouteKind(routeName: string): GameNavigationRouteKind | null {
  switch (routeName) {
    case 'GameConfig':
      return 'config';
    case 'GameGuide':
      return 'guide';
    case 'GameNotepad':
      return 'notepad';
    default:
      return null;
  }
}

function getParentRoomCode(routeName: string, params: unknown): string | null {
  const routeKind = getGameNavigationRouteKind(routeName);
  if (routeKind !== null) return getGameNavigationRoomCode(routeKind, params);
  return getOptionalRoomCode(params);
}

/** @internal Exported for contract testing only. */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [SITE_URL, 'https://werewolfgamejudge.pages.dev'],
  config: {
    screens: {
      Home: '',
      GameConfig: {
        path: 'game/:gameType/config/:mode/:roomCode?',
        parse: {
          gameType: parseGameType,
          roomCode: parseRoomCode,
        },
      },
      GameGuide: {
        path: 'game/:gameType/guide/:roomCode?',
        parse: {
          gameType: parseGameType,
          roomCode: parseRoomCode,
        },
      },
      GameNotepad: {
        path: 'game/:gameType/notepad/:roomCode',
        parse: {
          gameType: parseGameType,
          roomCode: parseRoomCode,
        },
      },
      Room: {
        path: 'room/:roomCode',
        parse: {
          roomCode: parseRoomCode,
        },
        stringify: {
          roomCode: (roomCode: string) => roomCode,
        },
      },
      Settings: 'settings/:roomCode?',
      MusicSettings: 'settings/music/:roomCode?',
      Appearance: 'appearance',
      Unlocks: 'unlocks/:userId?',
      Gacha: 'gacha',
      AuthLogin: 'auth/login',
      AuthEmail: 'auth/email',
      AuthForgotPassword: 'auth/forgot-password',
      AuthResetPassword: 'auth/reset-password',
    },
  },
  // Rebuild navigation stack when deep-linking into screens that expect a parent.
  // e.g. a game notepad URL becomes [Home, Room({roomCode}), GameNotepad({roomCode})].
  getStateFromPath(path, options) {
    const state = defaultGetStateFromPath(path, options);
    if (!state) return state;

    const routes = state.routes;
    const topRoute = routes[routes.length - 1];

    // Ensure Home is always at the bottom of the stack for deep-linked screens.
    // Without this, goBack()/cancel on directly-opened URLs would have nowhere to go.
    if (topRoute && topRoute.name !== 'Home' && routes.length === 1) {
      // Screens that can be opened from Room: inject Home + Room when roomCode is present.
      // Without roomCode, they were opened from Home — just inject Home as base.
      const ROOM_CHILD_SCREENS = new Set([
        'GameConfig',
        'GameGuide',
        'GameNotepad',
        'MusicSettings',
        'Settings',
      ]);
      if (ROOM_CHILD_SCREENS.has(topRoute.name)) {
        const roomCode = getParentRoomCode(topRoute.name, topRoute.params);
        if (roomCode !== null) {
          return {
            ...state,
            routes: [
              { name: 'Home' as const },
              { name: 'Room' as const, params: { roomCode } },
              topRoute,
            ],
            index: 2,
          };
        }
      }

      // All other screens: inject Home as base route
      return {
        ...state,
        routes: [{ name: 'Home' as const }, topRoute],
        index: 1,
      };
    }

    return state;
  },
  // Strip programmatic-only params from the browser URL.
  getPathFromState(state, options) {
    const path = defaultGetPathFromState(state, options);
    try {
      const url = new URL(path, 'http://placeholder');
      for (const key of TRANSIENT_PARAMS) {
        url.searchParams.delete(key);
      }
      return url.pathname + url.search;
    } catch {
      // Non-parseable paths (e.g. empty/relative) fall through unchanged
      navLog.debug('getPathFromState: URL parse fallback', { path });
      return path;
    }
  },
};

interface AppNavigatorProps {
  /** Called when NavigationContainer finishes first layout (first screen rendered). */
  onReady?: () => void;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({ onReady }) => {
  if (__DEV__) {
    navLog.debug('render');
  }

  return (
    <NavigationContainer
      linking={linking}
      ref={navigationRef}
      onReady={() => {
        reactNavigationIntegration.registerNavigationContainer(navigationRef);
        onReady?.();
      }}
    >
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'default',
        }}
        screenLayout={({ children }) => <ErrorBoundary>{children}</ErrorBoundary>}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: '狼人面杀电子裁判助手' }}
        />
        <Stack.Screen
          name="GameConfig"
          component={GameConfigHostRoute}
          options={{ title: '游戏配置', animation: 'slide_from_bottom' }}
          getId={({ params }) =>
            params.mode === 'create'
              ? undefined
              : `${params.gameType}-${params.mode}-${params.roomCode}`
          }
        />
        <Stack.Screen
          name="GameGuide"
          component={GameGuideHostRoute}
          options={{ title: '游戏图鉴', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="GameNotepad"
          component={GameNotepadHostRoute}
          options={{ title: '笔记', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Room" component={RoomResolverRoute} options={{ title: '房间' }} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: '设置', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="MusicSettings"
          component={MusicSettingsScreen}
          options={{ title: '音乐设置' }}
        />
        <Stack.Screen
          name="Appearance"
          component={AppearanceScreen}
          options={{ title: '选择形象' }}
        />
        <Stack.Screen name="Unlocks" component={UnlocksScreen} options={{ title: '解锁一览' }} />
        <Stack.Screen name="Gacha" component={GachaScreen} options={{ title: '扭蛋抽奖' }} />
        <Stack.Screen
          name="ShardExchange"
          component={ShardExchangeScreen}
          options={{ title: '碎片兑换' }}
        />
        <Stack.Screen
          name="Admin"
          component={AdminScreen}
          options={{ title: 'Admin', headerShown: false }}
        />
        {/* Auth modal screens — transparent overlay with centered card */}
        <Stack.Group
          screenOptions={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: colors.transparent },
          }}
        >
          <Stack.Screen name="AuthLogin" component={AuthLoginScreen} options={{ title: '登录' }} />
          <Stack.Screen
            name="AuthEmail"
            component={AuthEmailScreen}
            options={{ title: '邮箱认证' }}
          />
          <Stack.Screen
            name="AuthForgotPassword"
            component={AuthForgotPasswordScreen}
            options={{ title: '忘记密码' }}
          />
          <Stack.Screen
            name="AuthResetPassword"
            component={AuthResetPasswordScreen}
            options={{ title: '重置密码' }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
};
