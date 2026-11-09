import { buildRoomHeaderModel } from '../buildRoomHeaderModel';

describe('buildRoomHeaderModel', () => {
  const onBack = () => undefined;
  const onTitlePress = () => undefined;
  const onTitleLongPress = () => undefined;
  const onUserActionPress = () => undefined;
  const user = { id: 'u1', avatarUrl: null };

  it('passes handlers through and sums the gacha balances', () => {
    const header = buildRoomHeaderModel({
      onBack,
      onTitlePress,
      onTitleLongPress,
      user,
      gachaStatus: { normalDraws: 3, goldenDraws: 2 },
      onUserActionPress,
    });
    expect(header.onBack).toBe(onBack);
    expect(header.onTitlePress).toBe(onTitlePress);
    expect(header.onTitleLongPress).toBe(onTitleLongPress);
    expect(header.userAction).toEqual({ user, ticketCount: 5, onPress: onUserActionPress });
  });

  it('reports a null ticket count while the gacha balance is unknown', () => {
    for (const gachaStatus of [null, undefined]) {
      const header = buildRoomHeaderModel({
        onBack,
        onTitlePress,
        onTitleLongPress,
        user: null,
        gachaStatus,
        onUserActionPress,
      });
      expect(header.userAction?.ticketCount).toBeNull();
      expect(header.userAction?.user).toBeNull();
    }
  });
});
