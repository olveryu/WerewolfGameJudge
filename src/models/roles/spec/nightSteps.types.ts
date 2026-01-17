/**
 * Night Steps Types
 *
 * 夜晚步骤表类型定义。
 *
 * ⚠️ 重要：这是 host-side view-model，用于 UI 展示/音频编排。
 * visibility 字段不得进入 BroadcastGameState（反作弊红线）。
 */

import type { RoleId } from './specs';
import type { SchemaId } from './schemas';

/**
 * 步骤可见性配置
 *
 * ⚠️ 这是 host-side view-model，用于 UI 展示/音频编排。
 * 不替代角色固有 wolfMeeting 定义（canSeeWolves/participatesInWolfVote）。
 * ⚠️ visibility 字段不得进入 BroadcastGameState（反作弊红线）。
 */
export interface StepVisibility {
  /** 是否单独行动（不能看到队友） */
  readonly actsSolo: boolean;
  /** 是否是狼会阶段（host-side view-model，用于展示狼队友） */
  readonly wolfMeetingPhase?: boolean;
}

/**
 * 夜晚步骤规格
 *
 * ⚠️ step.id 即 schemaId（一一对应，无需双字段）
 */
export interface StepSpec {
  /** 步骤 ID（同时作为 schemaId） */
  readonly id: SchemaId;
  /** 执行此步骤的角色 */
  readonly roleId: RoleId;
  /** 开始音频文件名（不含路径和扩展名） */
  readonly audioKey: string;
  /** 结束音频文件名（可选，默认使用 audioKey） */
  readonly audioEndKey?: string;
  /** 可见性配置 */
  readonly visibility: StepVisibility;
}
