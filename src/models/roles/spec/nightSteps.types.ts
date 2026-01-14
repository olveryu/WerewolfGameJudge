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
 * ⚠️ 重要约束：step.id === step.schemaId（强制一一对应）
 * 
 * 💡 终局清理项（M3+）：
 * 建议删除 schemaId 字段，只保留 id 作为 schemaId。
 * 因为强制相等，双字段存在"双写漂移"风险。
 * 届时 NightPlanStep.stepId 直接取 step.id 即可。
 */
export interface StepSpec {
  /** 步骤 ID（必须等于 schemaId，终局可合并为单一字段） */
  readonly id: SchemaId;
  /** 执行此步骤的角色 */
  readonly roleId: RoleId;
  /** UI 使用的 schema（强制 === id） */
  readonly schemaId: SchemaId;
  /** 开始音频文件名（不含路径和扩展名） */
  readonly audioKey: string;
  /** 结束音频文件名（可选，默认使用 audioKey） */
  readonly audioEndKey?: string;
  /** 可见性配置 */
  readonly visibility: StepVisibility;
}
