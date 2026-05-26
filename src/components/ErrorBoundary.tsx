/**
 * ErrorBoundary - Global error boundary.
 *
 * Responsibilities:
 * - Catch unhandled JS errors in child component tree
 * - Show fallback UI and retry button
 * - Log error + report to Sentry
 *
 * Not responsible for:
 * - Business logic or service calls
 * - Async error capture (only render-time errors)
 *
 * Boundary constraints:
 * - Uses hardcoded styles (class component at the top of component tree, must self-contain fallback styles)
 * - Does not import service, contains no business logic
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
