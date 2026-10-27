/**
 * Compile-only contract: every bottom button declares its audience, and
 * the view-identity builder accepts only the two audiences a view action
 * can honestly hold (room-shell-contract "Action Ownership").
 */
import type {
  RoomBottomButton,
  RoomBottomToolButton,
} from '../src/features/room/model/RoomBottomActions';
import { buildViewIdentityButton } from '../src/features/room/model/RoomBottomActions';

declare function acceptButton(button: RoomBottomButton): void;
declare function acceptTool(tool: RoomBottomToolButton): void;
declare const onPress: () => void;

acceptButton({
  key: 'view',
  label: '查看身份',
  audience: 'participant',
  variant: 'primary',
  size: 'md',
  isEnabled: true,
  onPress,
});
acceptTool({
  key: 'review',
  label: '本局复盘',
  audience: 'anyone',
  tone: 'default',
  isEnabled: true,
  onPress,
});

// @ts-expect-error A bottom button must declare who it is for.
acceptButton({
  key: 'view',
  label: '查看身份',
  variant: 'primary',
  size: 'md',
  isEnabled: true,
  onPress,
});
// @ts-expect-error A dock tool must declare who it is for.
acceptTool({ key: 'review', label: '本局复盘', tone: 'default', isEnabled: true, onPress });
acceptButton({
  key: 'x',
  label: 'x',
  // @ts-expect-error Only the three ownership classes exist.
  audience: 'player',
  variant: 'ghost',
  size: 'md',
  isEnabled: true,
  onPress,
});

buildViewIdentityButton(
  { label: '查看身份', onPress },
  { key: 'view', variant: 'primary', audience: 'participant' },
);
buildViewIdentityButton(
  { label: '查看题目', onPress },
  { key: 'view', variant: 'secondary', audience: 'anyone' },
);
buildViewIdentityButton(
  { label: '查看身份', onPress },
  // @ts-expect-error Viewing an identity is never a host-only command.
  { key: 'view', variant: 'primary', audience: 'host' },
);
