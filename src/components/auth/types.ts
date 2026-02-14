/**
 * Auth 共享组件样式接口
 *
 * 统一 HomeScreen 和 SettingsScreen 的登录/注册组件样式 key。
 * 各 screen 的 styles factory 需实现此接口的子集。
 *
 * ✅ 允许：类型定义
 * ❌ 禁止：运行时逻辑 / 硬编码值
 */
import { type TextStyle, type ViewStyle } from 'react-native';

import { type ThemeColors } from '@/theme';

/** EmailForm + LoginOptions 共用的样式 key */
export interface AuthStyles {
  // Layout
  formContainer: ViewStyle;
  formTitle: TextStyle;
  formSubtitle: TextStyle;
  // Input
  input: TextStyle;
  passwordWrapper: ViewStyle;
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
}

/** EmailForm props — 两端共享 */
export interface EmailFormProps {
  isSignUp: boolean;
  email: string;
  password: string;
  displayName: string;
  authError: string | null;
  authLoading: boolean;
  onEmailChange: (text: string) => void;
  onPasswordChange: (text: string) => void;
  onDisplayNameChange: (text: string) => void;
  onSubmit: () => void;
  onToggleMode: () => void;
  onBack: () => void;
  styles: AuthStyles;
  colors: ThemeColors;
}

/** LoginOptions props — 两端共享 */
export interface LoginOptionsProps {
  authLoading: boolean;
  /** 标题，不传则不显示（Settings 卡片已有标题时省略） */
  title?: string;
  /** 副标题，不传则不显示 */
  subtitle?: string;
  onEmailLogin: () => void;
  onAnonymousLogin: () => void;
  /** 不传则不显示取消按钮（Settings 不需要） */
  onCancel?: () => void;
  styles: AuthStyles;
}
