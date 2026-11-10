/**
 * Reveal Dialog Classification Test
 *
 * Verifies that the RoomScreenTestHarness correctly classifies reveal dialogs
 * by publishing alerts with reveal-style title/message patterns through the real alert store.
 *
 * The actual reveal flow (tap seat → submit → server provides data → dialog) is covered by
 * integration/E2E tests. This test ensures the harness classification layer is correct, so
 * when reveals DO appear, they are properly tracked.
 */

import { recordAlerts, RoomScreenTestHarness } from '@/games/werewolf/room/__tests__/harness';
import { showAlert } from '@/utils/alert';

describe('Reveal Dialog Classification', () => {
  let harness: RoomScreenTestHarness;
  let detachAlerts: () => void;

  beforeEach(() => {
    harness = new RoomScreenTestHarness();
    detachAlerts = recordAlerts(harness);
  });
  afterEach(() => detachAlerts());

  describe('seerReveal', () => {
    it('classifies seer reveal by title containing "查验结果"', () => {
      showAlert('查验结果：3号是好人', '', [{ text: '知道了' }]);
      expect(harness.hasSeen('seerReveal')).toBe(true);
      expect(harness.eventsOfType('seerReveal')).toHaveLength(1);
    });

    it('classifies seer reveal by title containing "预言家"', () => {
      showAlert('预言家查验', '3号是好人', [{ text: '知道了' }]);
      expect(harness.hasSeen('seerReveal')).toBe(true);
    });
  });

  describe('psychicReveal', () => {
    it('classifies psychic reveal by title containing "通灵师"', () => {
      showAlert('通灵师结果', '5号是狼人', [{ text: '知道了' }]);
      expect(harness.hasSeen('psychicReveal')).toBe(true);
    });

    it('classifies psychic reveal by title containing "通灵结果"', () => {
      showAlert('通灵结果：5号是狼人', '', [{ text: '知道了' }]);
      expect(harness.hasSeen('psychicReveal')).toBe(true);
    });
  });

  describe('gargoyleReveal', () => {
    it('classifies gargoyle reveal by title containing "石像鬼"', () => {
      showAlert('石像鬼探查：2号是狼人', '', [{ text: '知道了' }]);
      expect(harness.hasSeen('gargoyleReveal')).toBe(true);
    });
  });

  describe('wolfRobotReveal', () => {
    it('classifies wolfRobot reveal by title containing "机械狼人"', () => {
      showAlert('机械狼人学习结果', '你学习了预言家', [{ text: '知道了' }]);
      expect(harness.hasSeen('wolfRobotReveal')).toBe(true);
    });

    it('classifies wolfRobot reveal by title containing "学习结果"', () => {
      showAlert('学习结果：7号是猎人', '', [{ text: '知道了' }]);
      expect(harness.hasSeen('wolfRobotReveal')).toBe(true);
    });
  });

  describe('reveal dialog button callback', () => {
    it('pressing primary on reveal dialog invokes the callback', async () => {
      const onConfirm = vi.fn();
      showAlert('查验结果：3号是好人', '', [{ text: '知道了', onPress: onConfirm }]);

      expect(harness.hasSeen('seerReveal')).toBe(true);
      await harness.pressPrimaryOnType('seerReveal');
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('no misclassification', () => {
    it('wolf vote title is NOT classified as reveal', () => {
      showAlert('狼人投票', '确定袭击1号？', [{ text: '取消', style: 'cancel' }, { text: '确定' }]);
      expect(harness.hasSeen('seerReveal')).toBe(false);
      expect(harness.hasSeen('wolfVote')).toBe(true);
    });

    it('action prompt with 预言家 is classified as actionPrompt, not seerReveal', () => {
      // Title ends with '行动' → seerReveal rule excludes it, falls through to actionPrompt.
      showAlert('预言家请行动', '请选择要查验的玩家', [{ text: '知道了' }]);
      const event = harness.getLastEvent();
      expect(event).not.toBeNull();
      expect(event!.type).toBe('actionPrompt');
    });
  });
});
