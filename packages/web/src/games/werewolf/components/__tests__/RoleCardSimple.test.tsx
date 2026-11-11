/** The werewolf role card dialog: presented identity, faction badge, variant pills. */
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { setAIChatBridgeListener } from '@/games/werewolf/services/aiChatBridge';
import { TESTIDS } from '@/testids';

const { showConfirmAlertMock } = vi.hoisted(() => ({
  showConfirmAlertMock: vi.fn<(title: string, message: string, onConfirm: () => void) => void>(),
}));

vi.mock('@/utils/alertPresets', () => ({ showConfirmAlert: showConfirmAlertMock }));

interface AIChatPayload {
  readonly fullText: string;
  readonly displayText: string;
  readonly maxTokens?: number;
}

const defaultProps: {
  readonly visible: boolean;
  readonly roleId: RoleId | null;
  readonly onClose: () => void;
} = {
  visible: true,
  roleId: 'wolf',
  onClose: vi.fn<() => void>(),
};

describe('RoleCardSimple', () => {
  afterEach(() => {
    act(() => setAIChatBridgeListener(null));
    showConfirmAlertMock.mockClear();
  });

  it('renders nothing when not visible', () => {
    render(<RoleCardSimple {...defaultProps} visible={false} />);
    expect(screen.queryByText('狼人')).not.toBeInTheDocument();
  });

  it('renders nothing when roleId is null', () => {
    render(<RoleCardSimple {...defaultProps} roleId={null} />);
    expect(screen.queryByText('狼人')).not.toBeInTheDocument();
  });

  it('shows the role name, faction badge, portrait and its single-field description centered', () => {
    render(<RoleCardSimple {...defaultProps} />);
    expect(screen.getByText('狼人')).toBeInTheDocument();
    expect(screen.getByText('狼人阵营')).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.roleBadge)).toHaveAttribute(
      'src',
      expect.stringMatching(/wolf/),
    );
    expect(screen.getByRole('heading', { name: '技能介绍' })).toBeInTheDocument();
    expect(screen.queryByText('主动技能')).not.toBeInTheDocument();
  });

  it('calls onClose when the confirm button is pressed', () => {
    const onClose = vi.fn<() => void>();
    render(<RoleCardSimple {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '知道了' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['seer', '神职阵营', '预言家'],
    ['villager', '好人阵营', '平民'],
    ['witch', '神职阵营', '女巫'],
    ['hunter', '神职阵营', '猎人'],
  ] satisfies [RoleId, string, string][])('shows %s with its faction', (roleId, faction, name) => {
    render(<RoleCardSimple {...defaultProps} roleId={roleId} />);
    expect(screen.getByText(faction)).toBeInTheDocument();
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it('prefixes the seer label on dual-seer boards, including a disguised mirrorSeer', () => {
    const { rerender } = render(<RoleCardSimple {...defaultProps} roleId="seer" seerLabel={1} />);
    expect(screen.getByText('1号预言家')).toBeInTheDocument();

    rerender(<RoleCardSimple {...defaultProps} roleId="mirrorSeer" seerLabel={2} />);
    expect(screen.getByText('2号预言家')).toBeInTheDocument();
  });

  it('switches variants from the pill bar and shows the active variant', () => {
    const onVariantSelect = vi.fn<(variantId: RoleId) => void>();
    render(
      <RoleCardSimple
        {...defaultProps}
        roleId="witch"
        showRealIdentity
        variantIds={['witch', 'poisoner']}
        activeVariant="poisoner"
        onVariantSelect={onVariantSelect}
      />,
    );

    expect(screen.getByTestId(TESTIDS.configVariantOption('poisoner'))).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByTestId(TESTIDS.configVariantOption('witch')));

    expect(onVariantSelect).toHaveBeenCalledWith('witch');
  });

  it('offers the AI guide when a room chat is available, even without caller wiring', () => {
    const listener = vi.fn<(payload: AIChatPayload) => void>();
    const onClose = vi.fn();
    act(() => setAIChatBridgeListener(listener));
    render(<RoleCardSimple {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'AI 攻略' }));

    expect(showConfirmAlertMock).toHaveBeenCalledWith(
      'AI 攻略',
      '让 AI 分析「狼人」的玩法？',
      expect.any(Function),
    );
    const confirm = showConfirmAlertMock.mock.calls[0]?.[2];
    if (confirm === undefined) throw new Error('Expected the AI confirmation callback');
    act(confirm);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ displayText: '狼人 攻略', maxTokens: 1024 }),
    );
  });

  it('uses the presented identity for the AI prompt when the role is disguised', () => {
    const listener = vi.fn<(payload: AIChatPayload) => void>();
    act(() => setAIChatBridgeListener(listener));
    render(<RoleCardSimple {...defaultProps} roleId="mirrorSeer" />);

    expect(screen.getByRole('heading', { name: '预言家' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AI 攻略' }));
    expect(showConfirmAlertMock).toHaveBeenCalledWith(
      'AI 攻略',
      '让 AI 分析「预言家」的玩法？',
      expect.any(Function),
    );

    const confirm = showConfirmAlertMock.mock.calls[0]?.[2];
    if (confirm === undefined) throw new Error('Expected the AI confirmation callback');
    act(confirm);

    const payload = listener.mock.calls[0]?.[0];
    expect(payload?.displayText).toBe('预言家 攻略');
    expect(payload?.fullText).toContain('名称：预言家');
    expect(payload?.fullText).not.toContain('灯影预言家');
  });

  it.each([
    [false, 'seer'],
    [true, 'mirrorSeer'],
  ] satisfies [boolean, RoleId][])(
    'passes the card identity to explicit AI handlers (showRealIdentity=%s)',
    (showRealIdentity, expectedRoleId) => {
      const onAskAI = vi.fn<(id: RoleId) => void>();
      render(
        <RoleCardSimple
          {...defaultProps}
          roleId="mirrorSeer"
          showRealIdentity={showRealIdentity}
          onAskAI={onAskAI}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'AI 攻略' }));

      expect(onAskAI).toHaveBeenCalledWith(expectedRoleId);
    },
  );

  it('hides the AI guide when no room chat is mounted', () => {
    render(<RoleCardSimple {...defaultProps} />);

    expect(screen.queryByRole('button', { name: 'AI 攻略' })).not.toBeInTheDocument();
  });
});
