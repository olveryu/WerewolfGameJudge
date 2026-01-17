/**
 * RoleCard.stories.tsx - Stories for role card display
 *
 * Shows how different roles are displayed when players view their identity.
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ROLE_SPECS } from '../../../models/roles/spec/specs';
import type { Faction } from '../../../models/roles/spec/types';

// Mock RoleCard component
interface RoleCardProps {
  roleName: string;
  displayName: string;
  description: string;
  faction: Faction;
}

const factionColors: Record<Faction, string> = {
  wolf: '#DC2626',
  god: '#3B82F6',
  villager: '#22C55E',
  special: '#A855F7',
};

const factionLabels: Record<Faction, string> = {
  wolf: '狼人阵营',
  god: '神职阵营',
  villager: '平民阵营',
  special: '第三方',
};

const RoleCard: React.FC<RoleCardProps> = ({ roleName, displayName, description, faction }) => (
  <View style={[styles.card, { borderColor: factionColors[faction] }]}>
    <View style={[styles.header, { backgroundColor: factionColors[faction] }]}>
      <Text style={styles.factionLabel}>{factionLabels[faction]}</Text>
    </View>
    <View style={styles.body}>
      <Text style={styles.title}>你的身份是：{displayName}</Text>
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>【技能介绍】</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
    <View style={styles.footer}>
      <Text style={styles.roleId}>({roleName})</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  header: {
    padding: 8,
    alignItems: 'center',
  },
  factionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  body: {
    padding: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 12,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
  },
  description: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    padding: 8,
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  roleId: {
    color: '#6B7280',
    fontSize: 10,
  },
});

const meta: Meta<typeof RoleCard> = {
  title: 'RoomScreen/RoleCard',
  component: RoleCard,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
};

export default meta;
type Story = StoryObj<typeof RoleCard>;

// ─────────────────────────────────────────────────────────────────────────────
// God Roles (神职)
// ─────────────────────────────────────────────────────────────────────────────

export const Seer: Story = {
  name: '🔮 预言家',
  args: {
    roleName: 'seer',
    displayName: ROLE_SPECS.seer.displayName,
    description: ROLE_SPECS.seer.description,
    faction: ROLE_SPECS.seer.faction,
  },
};

export const Witch: Story = {
  name: '🧪 女巫',
  args: {
    roleName: 'witch',
    displayName: ROLE_SPECS.witch.displayName,
    description: ROLE_SPECS.witch.description,
    faction: ROLE_SPECS.witch.faction,
  },
};

export const Guard: Story = {
  name: '🛡️ 守卫',
  args: {
    roleName: 'guard',
    displayName: ROLE_SPECS.guard.displayName,
    description: ROLE_SPECS.guard.description,
    faction: ROLE_SPECS.guard.faction,
  },
};

export const Hunter: Story = {
  name: '🎯 猎人',
  args: {
    roleName: 'hunter',
    displayName: ROLE_SPECS.hunter.displayName,
    description: ROLE_SPECS.hunter.description,
    faction: ROLE_SPECS.hunter.faction,
  },
};

export const Psychic: Story = {
  name: '👁️ 通灵师',
  args: {
    roleName: 'psychic',
    displayName: ROLE_SPECS.psychic.displayName,
    description: ROLE_SPECS.psychic.description,
    faction: ROLE_SPECS.psychic.faction,
  },
};

export const Magician: Story = {
  name: '🎩 魔术师',
  args: {
    roleName: 'magician',
    displayName: ROLE_SPECS.magician.displayName,
    description: ROLE_SPECS.magician.description,
    faction: ROLE_SPECS.magician.faction,
  },
};

export const Dreamcatcher: Story = {
  name: '🌙 摄梦人',
  args: {
    roleName: 'dreamcatcher',
    displayName: ROLE_SPECS.dreamcatcher.displayName,
    description: ROLE_SPECS.dreamcatcher.description,
    faction: ROLE_SPECS.dreamcatcher.faction,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Wolf Roles (狼人)
// ─────────────────────────────────────────────────────────────────────────────

export const Wolf: Story = {
  name: '🐺 狼人',
  args: {
    roleName: 'wolf',
    displayName: ROLE_SPECS.wolf.displayName,
    description: ROLE_SPECS.wolf.description,
    faction: ROLE_SPECS.wolf.faction,
  },
};

export const WolfQueen: Story = {
  name: '👑 狼王',
  args: {
    roleName: 'wolfQueen',
    displayName: ROLE_SPECS.wolfQueen.displayName,
    description: ROLE_SPECS.wolfQueen.description,
    faction: ROLE_SPECS.wolfQueen.faction,
  },
};

export const Nightmare: Story = {
  name: '😈 梦魇',
  args: {
    roleName: 'nightmare',
    displayName: ROLE_SPECS.nightmare.displayName,
    description: ROLE_SPECS.nightmare.description,
    faction: ROLE_SPECS.nightmare.faction,
  },
};

export const Gargoyle: Story = {
  name: '🗿 石像鬼',
  args: {
    roleName: 'gargoyle',
    displayName: ROLE_SPECS.gargoyle.displayName,
    description: ROLE_SPECS.gargoyle.description,
    faction: ROLE_SPECS.gargoyle.faction,
  },
};

export const DarkWolfKing: Story = {
  name: '🖤 黑狼王',
  args: {
    roleName: 'darkWolfKing',
    displayName: ROLE_SPECS.darkWolfKing.displayName,
    description: ROLE_SPECS.darkWolfKing.description,
    faction: ROLE_SPECS.darkWolfKing.faction,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Villager & Special
// ─────────────────────────────────────────────────────────────────────────────

export const Villager: Story = {
  name: '👨‍🌾 平民',
  args: {
    roleName: 'villager',
    displayName: ROLE_SPECS.villager.displayName,
    description: ROLE_SPECS.villager.description,
    faction: ROLE_SPECS.villager.faction,
  },
};

export const Slacker: Story = {
  name: '😴 懒汉',
  args: {
    roleName: 'slacker',
    displayName: ROLE_SPECS.slacker.displayName,
    description: ROLE_SPECS.slacker.description,
    faction: ROLE_SPECS.slacker.faction,
  },
};
