/**
 * ActionButtons.stories.tsx - Stories for action button states
 *
 * Shows the different bottom action button combinations based on game state.
 * This is a mock component to visualize the button patterns.
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Mock button component (mimics RoomScreen action buttons)
interface ActionButton {
  key: string;
  label: string;
  onPress?: () => void;
}

interface ActionButtonsProps {
  buttons: ActionButton[];
  actionMessage?: string;
  disabled?: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  buttons,
  actionMessage,
  disabled = false,
}) => (
  <View style={mockStyles.container}>
    {actionMessage && <Text style={mockStyles.message}>{actionMessage}</Text>}
    <View style={mockStyles.buttonRow}>
      {buttons.map((b) => (
        <TouchableOpacity
          key={b.key}
          style={[mockStyles.button, disabled && mockStyles.disabled]}
          onPress={b.onPress}
          disabled={disabled}
        >
          <Text style={mockStyles.buttonText}>{b.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const mockStyles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    minWidth: 300,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  disabled: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

const meta: Meta<typeof ActionButtons> = {
  title: 'RoomScreen/ActionButtons',
  component: ActionButtons,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
};

export default meta;
type Story = StoryObj<typeof ActionButtons>;

// ─────────────────────────────────────────────────────────────────────────────
// Normal Role Actions (chooseSeat with canSkip)
// ─────────────────────────────────────────────────────────────────────────────

export const SeerAction: Story = {
  name: '🔮 Seer - Can Skip',
  args: {
    actionMessage: '请选择一名玩家查验身份',
    buttons: [{ key: 'skip', label: '不查验' }],
  },
};

export const GuardAction: Story = {
  name: '🛡️ Guard - Can Skip',
  args: {
    actionMessage: '请选择一名玩家进行守护',
    buttons: [{ key: 'skip', label: '不守护' }],
  },
};

export const WitchSaveAction: Story = {
  name: '🧪 Witch - Save Phase',
  args: {
    actionMessage: '3号玩家被杀，是否使用解药？',
    buttons: [
      { key: 'save', label: '救人' },
      { key: 'skip', label: '不救' },
    ],
  },
};

export const WitchPoisonAction: Story = {
  name: '☠️ Witch - Poison Phase',
  args: {
    actionMessage: '是否使用毒药？',
    buttons: [{ key: 'skip', label: '不毒' }],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Wolf Vote Actions
// ─────────────────────────────────────────────────────────────────────────────

export const WolfVoteNotVoted: Story = {
  name: '🐺 Wolf - Not Voted Yet',
  args: {
    actionMessage: '请选择要击杀的玩家\n投票情况: 无人投票',
    buttons: [{ key: 'empty', label: '投票空刀' }],
  },
};

export const WolfVotePartial: Story = {
  name: '🐺 Wolf - Partial Votes',
  args: {
    actionMessage: '请选择要击杀的玩家\n投票情况: 1号→3号, 4号待定',
    buttons: [{ key: 'empty', label: '投票空刀' }],
  },
};

export const WolfVoteAlreadyVoted: Story = {
  name: '🐺 Wolf - Already Voted (no buttons)',
  args: {
    actionMessage: '等待其他狼人投票...\n投票情况: 1号→3号, 4号→3号',
    buttons: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Blocked States
// ─────────────────────────────────────────────────────────────────────────────

export const BlockedWolfCanVote: Story = {
  name: '😵🐺 Blocked Wolf - Can Still Vote Empty',
  args: {
    actionMessage: '你被梦魇封锁了，无法指定目标\n投票情况: 1号待定',
    buttons: [{ key: 'empty', label: '投票空刀' }],
  },
};

export const BlockedNonWolf: Story = {
  name: '😵 Blocked Non-Wolf - No Buttons',
  args: {
    actionMessage: '你被梦魇封锁了，本回合无法行动',
    buttons: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Actions (after selecting target)
// ─────────────────────────────────────────────────────────────────────────────

export const HunterConfirm: Story = {
  name: '🎯 Hunter - Day Confirm',
  args: {
    actionMessage: '确认带走目标？',
    buttons: [{ key: 'confirm', label: '确认' }],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Disabled States
// ─────────────────────────────────────────────────────────────────────────────

export const AudioPlaying: Story = {
  name: '🔇 Audio Playing - Disabled',
  args: {
    actionMessage: '正在播放语音提示...',
    buttons: [{ key: 'skip', label: '不查验' }],
    disabled: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Magician Two-Step
// ─────────────────────────────────────────────────────────────────────────────

export const MagicianFirstTarget: Story = {
  name: '🎩 Magician - Select First Target',
  args: {
    actionMessage: '请选择第一个交换对象',
    buttons: [{ key: 'skip', label: '不交换' }],
  },
};

export const MagicianSecondTarget: Story = {
  name: '🎩 Magician - Select Second Target',
  args: {
    actionMessage: '已选择3号，请选择第二个交换对象',
    buttons: [{ key: 'cancel', label: '取消' }],
  },
};
