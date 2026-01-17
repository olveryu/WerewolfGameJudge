/**
 * RevealResult.stories.tsx - Stories for reveal result displays
 * 
 * Shows different reveal results for Seer, Psychic, and other checking roles.
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Seer Reveal (binary: 好人/狼人)
// ─────────────────────────────────────────────────────────────────────────────

interface SeerRevealProps {
  targetSeat: number;
  result: '好人' | '狼人';
}

const SeerReveal: React.FC<SeerRevealProps> = ({ targetSeat, result }) => (
  <View style={styles.card}>
    <Text style={styles.title}>🔮 查验结果</Text>
    <View style={styles.divider} />
    <Text style={styles.targetText}>{targetSeat}号玩家</Text>
    <View style={[
      styles.resultBadge,
      result === '狼人' ? styles.wolfBadge : styles.goodBadge
    ]}>
      <Text style={styles.resultText}>{result}</Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Psychic Reveal (specific role or faction)
// ─────────────────────────────────────────────────────────────────────────────

interface PsychicRevealProps {
  targetSeat: number;
  roleName: string;
  faction: 'wolf' | 'god' | 'villager' | 'special';
}

const factionColors = {
  wolf: '#DC2626',
  god: '#3B82F6',
  villager: '#22C55E',
  special: '#A855F7',
};

const PsychicReveal: React.FC<PsychicRevealProps> = ({ targetSeat, roleName, faction }) => (
  <View style={styles.card}>
    <Text style={styles.title}>👁️ 通灵结果</Text>
    <View style={styles.divider} />
    <Text style={styles.targetText}>{targetSeat}号玩家</Text>
    <View style={[styles.resultBadge, { backgroundColor: factionColors[faction] }]}>
      <Text style={styles.resultText}>{roleName}</Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Gargoyle Reveal (is same team)
// ─────────────────────────────────────────────────────────────────────────────

interface GargoyleRevealProps {
  targetSeat: number;
  isSameTeam: boolean;
}

const GargoyleReveal: React.FC<GargoyleRevealProps> = ({ targetSeat, isSameTeam }) => (
  <View style={styles.card}>
    <Text style={styles.title}>🗿 石像鬼查验</Text>
    <View style={styles.divider} />
    <Text style={styles.targetText}>{targetSeat}号玩家</Text>
    <View style={[
      styles.resultBadge,
      isSameTeam ? styles.wolfBadge : styles.notSameBadge
    ]}>
      <Text style={styles.resultText}>
        {isSameTeam ? '是狼队友' : '不是狼队友'}
      </Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Dreamcatcher Reveal (was visited)
// ─────────────────────────────────────────────────────────────────────────────

interface DreamcatcherRevealProps {
  targetSeat: number;
  wasVisited: boolean;
}

const DreamcatcherReveal: React.FC<DreamcatcherRevealProps> = ({ targetSeat, wasVisited }) => (
  <View style={styles.card}>
    <Text style={styles.title}>🌙 摄梦结果</Text>
    <View style={styles.divider} />
    <Text style={styles.targetText}>{targetSeat}号玩家</Text>
    <View style={[
      styles.resultBadge,
      wasVisited ? styles.visitedBadge : styles.notVisitedBadge
    ]}>
      <Text style={styles.resultText}>
        {wasVisited ? '昨晚有行动' : '昨晚没有行动'}
      </Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: 280,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 16,
  },
  targetText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 12,
  },
  resultBadge: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  wolfBadge: {
    backgroundColor: '#DC2626',
  },
  goodBadge: {
    backgroundColor: '#22C55E',
  },
  notSameBadge: {
    backgroundColor: '#6B7280',
  },
  visitedBadge: {
    backgroundColor: '#F59E0B',
  },
  notVisitedBadge: {
    backgroundColor: '#6B7280',
  },
  resultText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta & Stories
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'RoomScreen/RevealResult',
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
};

export default meta;

// Seer Stories
export const SeerGood: StoryObj<typeof SeerReveal> = {
  name: '🔮 Seer - 好人',
  render: () => <SeerReveal targetSeat={3} result="好人" />,
};

export const SeerWolf: StoryObj<typeof SeerReveal> = {
  name: '🔮 Seer - 狼人',
  render: () => <SeerReveal targetSeat={5} result="狼人" />,
};

// Psychic Stories
export const PsychicWolf: StoryObj<typeof PsychicReveal> = {
  name: '👁️ Psychic - 狼人',
  render: () => <PsychicReveal targetSeat={2} roleName="狼人" faction="wolf" />,
};

export const PsychicWolfQueen: StoryObj<typeof PsychicReveal> = {
  name: '👁️ Psychic - 狼王',
  render: () => <PsychicReveal targetSeat={7} roleName="狼王" faction="wolf" />,
};

export const PsychicSeer: StoryObj<typeof PsychicReveal> = {
  name: '👁️ Psychic - 预言家',
  render: () => <PsychicReveal targetSeat={4} roleName="预言家" faction="god" />,
};

export const PsychicVillager: StoryObj<typeof PsychicReveal> = {
  name: '👁️ Psychic - 平民',
  render: () => <PsychicReveal targetSeat={6} roleName="平民" faction="villager" />,
};

// Gargoyle Stories
export const GargoyleSameTeam: StoryObj<typeof GargoyleReveal> = {
  name: '🗿 Gargoyle - 是狼队友',
  render: () => <GargoyleReveal targetSeat={3} isSameTeam={true} />,
};

export const GargoyleNotSameTeam: StoryObj<typeof GargoyleReveal> = {
  name: '🗿 Gargoyle - 不是狼队友',
  render: () => <GargoyleReveal targetSeat={5} isSameTeam={false} />,
};

// Dreamcatcher Stories
export const DreamcatcherVisited: StoryObj<typeof DreamcatcherReveal> = {
  name: '🌙 Dreamcatcher - 有行动',
  render: () => <DreamcatcherReveal targetSeat={4} wasVisited={true} />,
};

export const DreamcatcherNotVisited: StoryObj<typeof DreamcatcherReveal> = {
  name: '🌙 Dreamcatcher - 没行动',
  render: () => <DreamcatcherReveal targetSeat={8} wasVisited={false} />,
};
