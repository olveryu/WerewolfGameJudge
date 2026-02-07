/**
 * Night Steps Types - 夜晚步骤表类型定义
 *
 * 定义 StepSpec 接口，描述单个夜晚步骤的结构。
 *
 * ✅ 允许：StepSpec 类型定义
 * ❌ 禁止：import service / 副作用
 */

import type { RoleId } from './specs';
import type { SchemaId } from './schemas';

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
}
