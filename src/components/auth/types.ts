/**
 * Shared style interface for Auth components.
 *
 * Unifies the style keys used by login/signup components in HomeScreen and SettingsScreen.
 * Each screen's styles factory implements a subset of this interface.
 * Exports type definitions only — no runtime logic, no hardcoded values.
 */
import { type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { type ThemeColors } from '@/theme';

/** Shared style keys for EmailForm + LoginOptions */
export interface AuthStyles {
  // Layout
  formContainer: ViewStyle;
  formTitle: TextStyle;
  formSubtitle: TextStyle;
  // Input
  input: TextStyle;
  passwordInputContainer: ViewStyle;
  passwordInput: TextStyle;
  passwordWrapper: ViewStyle;
  passwordWrapperFocused: ViewStyle;
  eyeButton: ViewStyle;
  errorText: TextStyle;
  // Email domain dropdown
  emailDomainDropdown: ViewStyle;
  emailDomainItem: ViewStyle;
  emailDomainText: TextStyle;
  // Buttons
  primaryButton: ViewStyle;
  primaryButtonText: TextStyle;
  secondaryButton: ViewStyle;
  secondaryButtonText: TextStyle;
  linkButton: ViewStyle;
  linkButtonText: TextStyle;
  outlineButton: ViewStyle;
  outlineButtonText: TextStyle;
  buttonDisabled: ViewStyle;
  buttonCaption: TextStyle;
  buttonCaptionInverse: TextStyle;
  buttonCaptionInverseMuted: TextStyle;
  // Avatar preview card (LoginOptions)
  avatarStripContainer: ViewStyle;
  avatarStripRow: ViewStyle;
  avatarStripImage: ImageStyle;
  avatarStripImageWrapper: ViewStyle;
  avatarStripLockOverlay: ViewStyle;
  avatarStripLockIcon: TextStyle;
  avatarStripText: TextStyle;
  avatarStripLink: TextStyle;
}

/** EmailForm props — shared across both ends */
export interface EmailFormProps {
  /** Override the form title (pass '绑定邮箱' when anonymous user is binding email). Defaults to isSignUp branch. */
  formTitle?: string;
  isSignUp: boolean;
  /** Hide display name field even in signUp mode (e.g. bind existing account) */
  hideDisplayName?: boolean;
  email: string;
  password: string;
  displayName: string;
  authError: string | null;
  authLoading: boolean;
  onEmailChange: (text: string) => void;
  onPasswordChange: (text: string) => void;
  onDisplayNameChange: (text: string) => void;
  onSubmit: () => void;
  onToggleMode?: () => void;
  onForgotPassword?: () => void;
  onBack: () => void;
  styles: AuthStyles;
  colors: ThemeColors;
}

/** LoginOptions props — shared across both ends */
export interface LoginOptionsProps {
  authLoading: boolean;
  /** Title; hidden if not passed (omitted when Settings card already has its own title) */
  title?: string;
  /** Subtitle; hidden if not passed */
  subtitle?: string;
  /** Tap "Email Sign Up" -> enter signup form */
  onEmailSignUp: () => void;
  /** Tap "Email Sign In" -> enter signin form */
  onEmailSignIn: () => void;
  onAnonymousLogin: () => void;
  /** Hide anonymous login button in WeChat mini-program env */
  hideAnonymous?: boolean;
  /** Anonymous-user upgrade mode: "Email Sign Up" -> "Bind Email" */
  isUpgrade?: boolean;
  /** Tap "Browse All Avatars" -> enter AppearanceScreen */
  onBrowseAvatars?: () => void;
  /** Hides the cancel button when not passed (Settings does not need it) */
  onCancel?: () => void;
  styles: AuthStyles;
}
