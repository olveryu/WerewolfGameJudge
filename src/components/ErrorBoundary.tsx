/**
 * ErrorBoundary - 全局错误边界
 *
 * 捕获子组件树中未处理的 JS 错误，显示降级 UI 并提供重试。
 * 防止整个 app 因单一渲染错误白屏崩溃。
 * 渲染降级 UI 并记录错误日志。不 import service，不含业务逻辑。
 *
 * 样式例外：使用硬编码颜色/间距，因为 ErrorBoundary 是 class component，
 * 在 ThemeProvider crash 时无法调用 useColors()，必须自包含 fallback 样式。
 */
import * as Sentry from '@sentry/react-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { STATUS } from '@/config/emojiTokens';
import { log } from '@/utils/logger';

const errorLog = log.extend('ErrorBoundary');

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    errorLog.error('Uncaught error in component tree', {
      error: error.message,
      componentStack: info.componentStack,
    });
    Sentry.withScope((scope) => {
      scope.setExtra('componentStack', info.componentStack);
      Sentry.captureException(error);
    });
  }

  #handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>{STATUS.ERROR}</Text>
          <Text style={styles.title}>应用出现问题</Text>
          <Text style={styles.message}>请点击下方按钮重试</Text>
          <TouchableOpacity style={styles.button} onPress={this.#handleRetry}>
            <Text style={styles.buttonText}>重试</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
