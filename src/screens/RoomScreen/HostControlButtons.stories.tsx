/**
 * HostControlButtons.stories.tsx - Stories for the real HostControlButtons component
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HostControlButtons } from './HostControlButtons';

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper for proper sizing
// ─────────────────────────────────────────────────────────────────────────────

const ButtonWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={wrapperStyles.container}>{children}</View>
);

const wrapperStyles = StyleSheet.create({
  container: {
    width: 375,
    backgroundColor: '#111827',
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta<typeof HostControlButtons> = {
  title: 'RoomScreen/HostControlButtons',
  component: HostControlButtons,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <ButtonWrapper>
        <Story />
      </ButtonWrapper>
    ),
  ],
  // Default args - all buttons hidden
  args: {
    isHost: true,
    showSettings: false,
    showPrepareToFlip: false,
    showStartGame: false,
    showLastNightInfo: false,
    onSettingsPress: () => console.log('Settings'),
    onPrepareToFlipPress: () => console.log('Prepare to flip'),
    onStartGamePress: () => console.log('Start game'),
    onLastNightInfoPress: () => console.log('Last night info'),
  },
};

export default meta;
type Story = StoryObj<typeof HostControlButtons>;

// ─────────────────────────────────────────────────────────────────────────────
// Stories
// ─────────────────────────────────────────────────────────────────────────────

export const NotHost: Story = {
  name: '👤 非房主（不渲染）',
  args: {
    isHost: false,
  },
};

export const WaitingForPlayers: Story = {
  name: '⏳ 等待玩家加入',
  args: {
    showSettings: true,
  },
};

export const ReadyToPrepare: Story = {
  name: '✅ 可以准备看牌',
  args: {
    showSettings: true,
    showPrepareToFlip: true,
  },
};

export const PreparingPhase: Story = {
  name: '👀 看牌阶段',
  args: {
    showSettings: true,
    showStartGame: true,
  },
};

export const GameOngoing: Story = {
  name: '🌙 游戏进行中',
  args: {
    // No buttons in bottom bar during ongoing (restart moved to dropdown)
  },
};

export const DayPhase: Story = {
  name: '☀️ 白天阶段',
  args: {
    showLastNightInfo: true,
  },
};

export const GameFinished: Story = {
  name: '🏁 游戏结束',
  args: {
    showLastNightInfo: true,
  },
};

export const AllButtons: Story = {
  name: '🧪 全部按钮（测试用）',
  args: {
    showSettings: true,
    showPrepareToFlip: true,
    showStartGame: true,
    showLastNightInfo: true,
  },
};
