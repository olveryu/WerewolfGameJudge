/**
 * Night Steps Types
 * 
 * 夜晚步骤表类型定义。
 * 产品/策划可读可维护。
 */

import type { RoleId } from './specs';
import type { SchemaId } from './schemas';

/**
 * 夜晚步骤 ID
 * 
 * 每个步骤对应一个角色的夜间行动。
 * 命名规则：{角色}{动作}，如 seerCheck, witchAction
 */
export type NightStepId = 
  // 特殊角色（最先行动）
  | 'magicianSwap'
  | 'slackerChoose'
  // 守护类
  | 'dreamcatcherDream'
  | 'guardProtect'
  // 狼人阵营
  | 'nightmareBlock'
  | 'gargoyleCheck'
  | 'wolfRobotLearn'
  | 'wolfKill'
  | 'wolfQueenCharm'
  // 女巫
  | 'witchAction'
  // 查验类
  | 'seerCheck'
  | 'psychicCheck'
  // 确认类
  | 'hunterConfirm'
  | 'darkWolfKingConfirm';

/**
 * 步骤可见性配置
 */
export interface StepVisibility {
  /**
   * 是否单独行动（不能看到队友）
   * 
   * true: 此角色在这一步单独行动，即使是狼人也看不到队友
   * false: 正常可见性（狼人可以互相看到）
   * 
   * 例如：梦魇恐惧阶段 actsSolo=true
   */
  readonly actsSolo: boolean;
}

/**
 * 夜晚步骤规格
 * 
 * 定义一个夜晚行动步骤的所有信息。
 * 策划维护此表，定义夜晚行动顺序。
 * 
 * ⚠️ 重要：NIGHT_STEPS 数组的顺序 = 夜晚行动顺序
 */
export interface StepSpec {
  /** 步骤唯一 ID */
  readonly id: NightStepId;
  
  /**
   * 主持词标题（产品/策划可读）
   * 
   * 例如："预言家请睁眼，选择你今晚查验的玩家"
   */
  readonly title: string;
  
  /** 执行此步骤的角色 */
  readonly roleId: RoleId;
  
  /** UI 使用的 schema（决定如何渲染/收集输入） */
  readonly schemaId: SchemaId;
  
  /**
   * 开始音频文件名（不含路径和扩展名）
   * 
   * 对应 assets/audio/{audioKey}.mp3
   */
  readonly audioKey: string;
  
  /**
   * 结束音频文件名（不含路径和扩展名）
   * 
   * 对应 assets/audio_end/{audioEndKey}.mp3
   * 如果不指定，默认使用 audioKey
   */
  readonly audioEndKey?: string;
  
  /** 可见性配置 */
  readonly visibility: StepVisibility;
}
