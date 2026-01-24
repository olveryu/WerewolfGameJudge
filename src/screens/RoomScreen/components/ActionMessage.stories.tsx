/**
 * ActionMessage.stories.tsx - Stories for action message display
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActionMessage } from './ActionMessage';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={wrapperStyles.container}>{children}</View>
);

const wrapperStyles = StyleSheet.create({
  container: {
    width: 375,
    backgroundColor: '#FAFAFA',
    padding: 16,
  },
});

const meta: Meta<typeof ActionMessage> = {
  title: 'RoomScreen/ActionMessage',
  component: ActionMessage,
  decorators: [
    (Story) => (
      <Wrapper>
        <Story />
      </Wrapper>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ActionMessage>;

/** Seer action prompt */
export const SeerAction: Story = {
  args: {
    message: '请选择一名玩家进行查验',
  },
};

/** Witch save prompt */
export const WitchSave: Story = {
  args: {
    message: '今晚3号玩家被杀，是否使用解药？',
  },
};

/** Witch poison prompt */
export const WitchPoison: Story = {
  args: {
    message: '是否使用毒药？',
  },
};

/** Wolf kill prompt */
export const WolfKill: Story = {
  args: {
    message: '请与狼队友讨论并选择击杀目标',
  },
};

/** Guard protect prompt */
export const GuardProtect: Story = {
  args: {
    message: '请选择今晚要守护的玩家',
  },
};

/** Hunter check prompt */
export const HunterCheck: Story = {
  args: {
    message: '猎人请确认身份',
  },
};

/** Wolf with votes */
export const WolfWithVotes: Story = {
  args: {
    message: '请与狼队友讨论并选择击杀目标\n当前票型：3号(2票)',
  },
};
