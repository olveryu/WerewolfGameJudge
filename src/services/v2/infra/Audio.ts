/**
 * Audio - 音频服务抽象层
 *
 * 职责：
 * - 角色音频播放
 * - 夜晚开始/结束音频
 * - 播放状态管理
 *
 * 不做的事：
 * - 业务逻辑
 * - 游戏流程控制
 * - 状态管理
 *
 * Note: This is a thin wrapper around legacy AudioService
 * until we fully migrate. The API is designed for v2 architecture.
 */

import AudioService from '../../legacy/AudioService';
import type { RoleId } from '../../../models/roles';

// =============================================================================
// Audio Implementation
// =============================================================================

export class Audio {
  private static instance: Audio;
  private readonly audioService: AudioService;

  private constructor() {
    this.audioService = AudioService.getInstance();
  }

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  static getInstance(): Audio {
    if (!Audio.instance) {
      Audio.instance = new Audio();
    }
    return Audio.instance;
  }

  /** Reset singleton for testing */
  static resetInstance(): void {
    Audio.instance = undefined as unknown as Audio;
  }

  // ---------------------------------------------------------------------------
  // Night Audio
  // ---------------------------------------------------------------------------

  /** Play night start audio (天黑请闭眼) */
  async playNightBegin(): Promise<void> {
    return this.audioService.playNightBeginAudio();
  }

  /** Play night end audio (天亮了) */
  async playNightEnd(): Promise<void> {
    return this.audioService.playNightEndAudio();
  }

  // ---------------------------------------------------------------------------
  // Role Audio
  // ---------------------------------------------------------------------------

  /** Play role's beginning audio (when role's turn starts) */
  async playRoleBegin(role: RoleId): Promise<void> {
    return this.audioService.playRoleBeginningAudio(role);
  }

  /** Play role's ending audio (when role's turn ends) */
  async playRoleEnd(role: RoleId): Promise<void> {
    return this.audioService.playRoleEndingAudio(role);
  }

  // ---------------------------------------------------------------------------
  // Control
  // ---------------------------------------------------------------------------

  /** Stop all audio playback */
  stop(): void {
    this.audioService.stop();
  }

  /** Check if audio is currently playing */
  isPlaying(): boolean {
    return this.audioService.getIsPlaying();
  }

  /** Cleanup resources */
  cleanup(): void {
    this.audioService.cleanup();
  }
}

export default Audio;
