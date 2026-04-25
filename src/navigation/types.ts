import { GameTemplate } from '@werewolf/game-engine/models/Template';

export type RootStackParamList = {
  Home: undefined;
  BoardPicker:
    | {
        existingRoomCode?: string;
        nominateMode?: { roomCode: string };
      }
    | undefined;
  Config:
    | {
        // Optional: if provided, update existing room instead of creating new one
        existingRoomCode?: string;
        // Optional: if provided, auto-apply this preset template
        presetName?: string;
        // Optional: if provided, ConfigScreen is in "nominate" mode
        // User edits roles and submits as a board nomination
        nominateMode?: { roomCode: string };
      }
    | undefined;
  Room: {
    roomCode: string;
    isHost: boolean;
    template?: GameTemplate;
  };
  Settings: { roomCode?: string } | undefined;
  MusicSettings: { roomCode?: string } | undefined;
  Encyclopedia: { roomCode?: string; roleId?: string } | undefined;
  Notepad: { roomCode: string };
  AvatarPicker: undefined;
  Unlocks: { userId?: string; displayName?: string } | undefined;
  Gacha: undefined;
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
