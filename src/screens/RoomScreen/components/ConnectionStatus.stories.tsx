/**
 * ConnectionStatusBar.stories.tsx - Stories for connection status indicator
 * 
 * Shows different connection states:
 * - Connected (live)
 * - Reconnecting
 * - Disconnected/Offline
 * - Syncing
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Connection Status Bar
// ─────────────────────────────────────────────────────────────────────────────

type ConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'syncing';

interface ConnectionStatusBarProps {
  state: ConnectionState;
  roomCode?: string;
  lastSyncTime?: string;
  onRetry?: () => void;
}

const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  state,
  roomCode = '1234',
  lastSyncTime,
  onRetry,
}) => {
  const config = {
    connected: {
      bg: '#065F46',
      icon: '🟢',
      text: '已连接',
      showSpinner: false,
    },
    reconnecting: {
      bg: '#B45309',
      icon: '🟠',
      text: '重连中...',
      showSpinner: true,
    },
    disconnected: {
      bg: '#991B1B',
      icon: '🔴',
      text: '已断开',
      showSpinner: false,
    },
    syncing: {
      bg: '#1D4ED8',
      icon: '🔄',
      text: '同步中...',
      showSpinner: true,
    },
  };

  const { bg, icon, text, showSpinner } = config[state];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.left}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.text}>{text}</Text>
        {showSpinner && (
          <ActivityIndicator size="small" color="#fff" style={styles.spinner} />
        )}
      </View>
      
      <View style={styles.right}>
        {Boolean(roomCode) && (
          <Text style={styles.roomCode}>房间: {roomCode}</Text>
        )}
        {lastSyncTime && (
          <Text style={styles.syncTime}>上次同步: {lastSyncTime}</Text>
        )}
        {state === 'disconnected' && onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Full Status Banner (expanded view)
// ─────────────────────────────────────────────────────────────────────────────

const getStatusColor = (state: ConnectionState): string => {
  switch (state) {
    case 'connected': return '#22C55E';
    case 'reconnecting': return '#F59E0B';
    case 'syncing': return '#3B82F6';
    default: return '#EF4444';
  }
};

interface StatusBannerProps {
  state: ConnectionState;
  roomCode: string;
  playerCount: number;
  isHost: boolean;
  hostName?: string;
}

const StatusBanner: React.FC<StatusBannerProps> = ({
  state,
  roomCode,
  playerCount,
  isHost,
  hostName,
}) => (
  <View style={styles.banner}>
    <View style={styles.bannerTop}>
      <View style={styles.bannerLeft}>
        <Text style={styles.bannerRoomLabel}>房间号</Text>
        <Text style={styles.bannerRoomCode}>{roomCode}</Text>
      </View>
      <View style={styles.bannerRight}>
        <Text style={styles.playerCountText}>{playerCount}/12 玩家</Text>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(state) }]} />
      </View>
    </View>
    <View style={styles.bannerBottom}>
      <Text style={styles.bannerRole}>
        {isHost ? '👑 你是房主' : `房主: ${hostName || '未知'}`}
      </Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Toast Notification (connection change)
// ─────────────────────────────────────────────────────────────────────────────

interface ConnectionToastProps {
  type: 'joined' | 'left' | 'reconnected' | 'kicked';
  playerName?: string;
}

const ConnectionToast: React.FC<ConnectionToastProps> = ({ type, playerName }) => {
  const config = {
    joined: { icon: '✅', text: `${playerName} 加入了房间`, bg: '#166534' },
    left: { icon: '👋', text: `${playerName} 离开了房间`, bg: '#6B7280' },
    reconnected: { icon: '🔄', text: '已重新连接', bg: '#1D4ED8' },
    kicked: { icon: '⚠️', text: '你已被踢出房间', bg: '#991B1B' },
  };
  
  const { icon, text, bg } = config[type];
  
  return (
    <View style={[styles.toast, { backgroundColor: bg }]}>
      <Text style={styles.toastIcon}>{icon}</Text>
      <Text style={styles.toastText}>{text}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    width: 360,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 12,
    marginRight: 6,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  spinner: {
    marginLeft: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomCode: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  syncTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Banner styles
  banner: {
    width: 360,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
  },
  bannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bannerLeft: {},
  bannerRoomLabel: {
    color: '#6B7280',
    fontSize: 12,
  },
  bannerRoomCode: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  bannerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  playerCountText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bannerBottom: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 12,
  },
  bannerRole: {
    color: '#D1D5DB',
    fontSize: 14,
  },
  // Toast styles
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 200,
  },
  toastIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Meta & Stories
// ─────────────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'RoomScreen/ConnectionStatus',
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
};

export default meta;

// Connection Bar Stories
export const Connected: StoryObj<typeof ConnectionStatusBar> = {
  name: '🟢 连接正常',
  render: () => <ConnectionStatusBar state="connected" roomCode="1234" />,
};

export const Reconnecting: StoryObj<typeof ConnectionStatusBar> = {
  name: '🟠 重连中',
  render: () => <ConnectionStatusBar state="reconnecting" roomCode="1234" />,
};

export const Disconnected: StoryObj<typeof ConnectionStatusBar> = {
  name: '🔴 已断开',
  render: () => (
    <ConnectionStatusBar 
      state="disconnected" 
      roomCode="1234" 
      onRetry={() => alert('重试连接')}
    />
  ),
};

export const Syncing: StoryObj<typeof ConnectionStatusBar> = {
  name: '🔄 同步中',
  render: () => (
    <ConnectionStatusBar 
      state="syncing" 
      roomCode="1234" 
      lastSyncTime="2秒前"
    />
  ),
};

// Status Banner Stories
export const BannerHost: StoryObj<typeof StatusBanner> = {
  name: '📊 Banner - 房主视角',
  render: () => (
    <StatusBanner 
      state="connected"
      roomCode="1234"
      playerCount={8}
      isHost={true}
    />
  ),
};

export const BannerPlayer: StoryObj<typeof StatusBanner> = {
  name: '📊 Banner - 玩家视角',
  render: () => (
    <StatusBanner 
      state="connected"
      roomCode="5678"
      playerCount={6}
      isHost={false}
      hostName="小明"
    />
  ),
};

export const BannerDisconnected: StoryObj<typeof StatusBanner> = {
  name: '📊 Banner - 断开状态',
  render: () => (
    <StatusBanner 
      state="disconnected"
      roomCode="1234"
      playerCount={4}
      isHost={false}
      hostName="未知"
    />
  ),
};

// Toast Stories
export const ToastJoined: StoryObj<typeof ConnectionToast> = {
  name: '🔔 Toast - 玩家加入',
  render: () => <ConnectionToast type="joined" playerName="小红" />,
};

export const ToastLeft: StoryObj<typeof ConnectionToast> = {
  name: '🔔 Toast - 玩家离开',
  render: () => <ConnectionToast type="left" playerName="小明" />,
};

export const ToastReconnected: StoryObj<typeof ConnectionToast> = {
  name: '🔔 Toast - 重新连接',
  render: () => <ConnectionToast type="reconnected" />,
};

export const ToastKicked: StoryObj<typeof ConnectionToast> = {
  name: '🔔 Toast - 被踢出',
  render: () => <ConnectionToast type="kicked" />,
};
