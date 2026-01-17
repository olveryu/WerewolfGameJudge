/**
 * ConnectionStatusBar.stories.tsx - Stories for the real ConnectionStatusBar component
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ConnectionStatusBar } from './ConnectionStatusBar';

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper
// ─────────────────────────────────────────────────────────────────────────────

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={wrapperStyles.container}>{children}</View>
);

const wrapperStyles = StyleSheet.create({
  container: {
    width: 375,
    backgroundColor: '#111827',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof ConnectionStatusBar> = {
  title: 'RoomScreen/ConnectionStatusBar',
  component: ConnectionStatusBar,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <Wrapper>
        <Story />
      </Wrapper>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ConnectionStatusBar>;

// ─────────────────────────────────────────────────────────────────────────────
// Stories
// ─────────────────────────────────────────────────────────────────────────────

export const Live: Story = {
  name: '🟢 已连接',
  args: {
    status: 'live',
  },
};

export const Syncing: Story = {
  name: '🔄 同步中',
  args: {
    status: 'syncing',
    onForceSync: () => console.log('Force sync'),
  },
};

export const Connecting: Story = {
  name: '⏳ 连接中',
  args: {
    status: 'connecting',
  },
};

export const Disconnected: Story = {
  name: '🔴 已断开',
  args: {
    status: 'disconnected',
    onForceSync: () => console.log('Force sync'),
  },
};
