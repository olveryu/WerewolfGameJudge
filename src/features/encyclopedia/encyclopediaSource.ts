/**
 * 图鉴数据源注入接口：共享图鉴机器只认这组形状，各游戏在绑定层
 * 用自己的角色数据源（引擎 spec / 客户端 meta）适配进来。
 *
 * tags 与 tagCatalog 是可选能力：数据源不提供 tagCatalog 时，
 * 图鉴不显能力筛选入口，条目也不显标签 chips。
 */
import type { ImageSourcePropType } from 'react-native';

import type { DescriptionField } from '@/features/room/model/RevealRoleData';
import type { ThemeColors } from '@/theme';

/** 能力标签描述（绑定层把游戏自有 tag 体系翻译成这一份形状）。 */
export interface EncyclopediaRoleTag {
  readonly key: string;
  readonly label: string;
  readonly colorKey: keyof ThemeColors;
}

/** 阵营分组：决定「全部」视图的分组顺序、分组头与阵营筛选 tab。 */
export interface EncyclopediaFactionGroup {
  readonly key: string;
  readonly label: string;
  readonly colorKey: keyof ThemeColors;
}

/** 单个角色的图鉴条目（全部展示数据由绑定层预先备好，机器不回查数据源）。 */
export interface EncyclopediaRoleEntry {
  readonly id: string;
  readonly displayName: string;
  /** 详情 hero 的副标题（如英文名）；无则不显。 */
  readonly subtitle?: string;
  /** 所属阵营分组 key（与 factionGroups 对应）。 */
  readonly factionKey: string;
  /** 详情 hero 的阵营 chip 文案。 */
  readonly factionLabel: string;
  /** 阵营语义色（theme token 键名）。 */
  readonly factionColorKey: keyof ThemeColors;
  /** 一句话介绍：结构化字段为空时的详情兜底文案。 */
  readonly description?: string;
  /** 搜索 haystack（绑定层拼好：名字/别名/介绍全文）。 */
  readonly searchText: string;
  /** 结构化介绍字段（共享 StructuredDescriptionView 渲染）。 */
  readonly structuredFields: readonly DescriptionField[];
  readonly tags?: readonly EncyclopediaRoleTag[];
  /** 列表卡片图（狼人杀为徽章图；无则不显）。 */
  readonly listImage?: ImageSourcePropType;
  /** 详情 hero 图（立绘；无则不显）。 */
  readonly detailImage?: ImageSourcePropType;
}

/** 一个游戏的完整图鉴数据源。 */
export interface EncyclopediaRoleSource {
  readonly roles: readonly EncyclopediaRoleEntry[];
  readonly factionGroups: readonly EncyclopediaFactionGroup[];
  /** 能力标签目录（筛选下拉用）；缺省 = 本游戏无标签筛选。 */
  readonly tagCatalog?: readonly EncyclopediaRoleTag[];
}
