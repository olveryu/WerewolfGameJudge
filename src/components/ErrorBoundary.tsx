/**
 * ErrorBoundary — 全局错误边界。
 *
 * 职责：
 * - 捕获子组件树中未处理的 JS 错误
 * - 显示降级 UI 并提供重试按钮
 * - 记录错误日志 + 上报 Sentry
 *
 * 不负责：
 * - 业务逻辑或 service 调用
 * - 异步错误捕获（仅捕获渲染期错误）
 *
 * 边界约束：
 * - 使用硬编码样式（class component，位于组件树最顶层，必须自包含 fallback 样式）
 * - 不 import service，不含业务逻辑
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sentry from '@sentry/react-native';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { STATUS_ICONS } from '@/config/iconTokens';
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
          <Ionicons name={STATUS_ICONS.ERROR} size={48} color="#FF6B6B" style={styles.emoji} />
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
