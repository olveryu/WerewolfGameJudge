/**
 * fibBottomLayout — Fib-specific BottomActionPanel adapter.
 */
import type { FibState } from '@werewolf/game-engine/fibking/types';

import type { RoomBottomLayout, RoomButtonConfig } from '@/components/room/RoomBottomActionPanel';
import { colors } from '@/theme';
import { showAlert } from '@/utils/alert';

type FibButtonConfig = Omit<RoomButtonConfig, 'size'> & Partial<Pick<RoomButtonConfig, 'size'>>;

interface CreateFibBottomLayoutParams {
  state: FibState;
  isHost: boolean;
  isFull: boolean;
  mySeat: number | null;
  onOpenSettings: () => void;
  onOpenIdentity: () => void;
  onStartRound: () => void;
  onReveal: () => void;
  onRestart: () => void;
  onNextRound: () => void;
}

function createButton(config: FibButtonConfig): RoomButtonConfig {
  return { size: 'lg', ...config };
}

export function createFibBottomLayout({
  state,
  isHost,
  isFull,
  mySeat,
  onOpenSettings,
  onOpenIdentity,
  onStartRound,
  onReveal,
  onRestart,
  onNextRound,
}: CreateFibBottomLayoutParams): RoomBottomLayout {
  if (state.phase === 'Lobby') {
    if (isHost) {
      return {
        primary: [
          createButton({
            key: 'start-round',
            label: isFull ? '开始本轮' : '还有空位未入座',
            variant: 'primary',
            disabled: !isFull,
            testID: 'fib-start-round',
            onPress: onStartRound,
          }),
        ],
        secondary: [],
        ghost: [
          createButton({
            key: 'settings',
            label: '房间配置',
            variant: 'ghost',
            size: 'md',
            testID: 'fib-settings-bottom',
            onPress: onOpenSettings,
          }),
        ],
      };
    }
    return {
      primary: [
        createButton({
          key: 'wait-host',
          label: mySeat !== null ? '等待房主开始' : '点座位入座',
          variant: 'secondary',
          disabled: true,
        }),
      ],
      secondary: [],
      ghost: [],
    };
  }

  if (state.phase === 'Starting') {
    return {
      primary: [
        createButton({
          key: 'starting',
          label: '出题中…',
          variant: 'secondary',
          disabled: true,
        }),
      ],
      secondary: [],
      ghost: [],
    };
  }

  if (state.phase === 'Playing') {
    return {
      primary: isHost
        ? [
            createButton({
              key: 'reveal',
              label: '公布答案',
              variant: 'primary',
              testID: 'fib-reveal',
              onPress: () =>
                showAlert('公布答案?', '将公开真词与所有人身份', [
                  { text: '取消', style: 'cancel' },
                  { text: '公布', onPress: onReveal },
                ]),
            }),
          ]
        : [],
      secondary:
        mySeat !== null
          ? [
              createButton({
                key: 'identity',
                label: '查看身份',
                variant: isHost ? 'secondary' : 'primary',
                testID: 'fib-view-identity',
                onPress: onOpenIdentity,
              }),
            ]
          : [],
      ghost: isHost ? [createRestartButton(onRestart)] : [],
    };
  }

  return {
    primary: isHost
      ? [
          createButton({
            key: 'next-round',
            label: '下一轮',
            variant: 'primary',
            testID: 'fib-next-round',
            onPress: onNextRound,
          }),
        ]
      : [
          createButton({
            key: 'wait-host',
            label: '等待房主',
            variant: 'secondary',
            disabled: true,
          }),
        ],
    secondary: [],
    ghost: isHost ? [createRestartButton(onRestart)] : [],
  };
}

function createRestartButton(onRestart: () => void): RoomButtonConfig {
  return createButton({
    key: 'restart',
    label: '重新开始',
    variant: 'ghost',
    size: 'md',
    textColor: colors.error,
    testID: 'fib-restart',
    onPress: () =>
      showAlert('重新开始?', '将弃掉本局回到房间', [
        { text: '取消', style: 'cancel' },
        { text: '重新开始', style: 'destructive', onPress: onRestart },
      ]),
  });
}
