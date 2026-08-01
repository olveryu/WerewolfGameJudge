import type {
  GameConfigRouteParams,
  GameGuideRouteParams,
  GameNotepadRouteParams,
} from '@/games/navigation';

export type RootStackParamList = {
  Home: undefined;
  Admin: undefined;
  GameConfig: GameConfigRouteParams;
  GameGuide: GameGuideRouteParams;
  GameNotepad: GameNotepadRouteParams;
  Room: {
    roomCode: string;
    entryReason?: 'created';
  };
  Settings: { roomCode?: string } | undefined;
  MusicSettings: { roomCode?: string } | undefined;
  Appearance: undefined;
  Unlocks: { userId?: string; displayName?: string } | undefined;
  Gacha: undefined;
  ShardExchange: undefined;
  // Auth modal screens
  AuthLogin:
    | {
        /** LoginOptions title (default: '登录') */
        loginTitle?: string;
        /** LoginOptions subtitle */
        loginSubtitle?: string;
      }
    | undefined;
  AuthEmail: {
    mode: 'signIn' | 'signUp';
    /** Override EmailForm title (e.g. '绑定邮箱') */
    formTitle?: string;
    /** Show sign-in ↔ sign-up toggle link (default: true) */
    showToggleMode?: boolean;
    /** Sign out before email auth — for switch-account mode (default: false) */
    signOutFirst?: boolean;
    /** Show '登录成功' toast (default: false) */
    showSuccessOnLogin?: boolean;
    /** Hide display name field in signUp mode (default: false) */
    hideDisplayName?: boolean;
    /** Navigate to Settings after signUp (default: false) */
    navigateSettingsOnSignUp?: boolean;
    /** True when opened from AuthLogin — success will pop(2) to clear both screens (default: false) */
    openedFromAuthLogin?: boolean;
  };
  AuthForgotPassword:
    | {
        email?: string;
      }
    | undefined;
  AuthResetPassword: {
    email: string;
  };
};

// For type-safe navigation
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
