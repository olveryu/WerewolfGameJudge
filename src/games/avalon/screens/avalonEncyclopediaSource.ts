/**
 * 阿瓦隆图鉴数据源：把客户端 avalonRoleMeta 适配成共享图鉴的注入接口。
 *
 * 角色介绍的唯一源是 avalonRoleMeta（结构化字段经卡链共用的
 * toAvalonRoleDescriptionFields 转换）；阿瓦隆没有能力 tags，
 * 故不提供 tagCatalog，图鉴不显标签筛选。
 */
import { AVALON_ROLES } from '@game-judge/game-engine/games/avalon/public';

import type { EncyclopediaRoleSource } from '@/features/encyclopedia/encyclopediaSource';

import { getRoleAvatar } from '../assets/roleAvatars';
import { toAvalonRoleDescriptionFields } from '../model/avalonRoleDescriptionFields';
import { getAvalonRoleMeta } from '../model/avalonRoleMeta';

/** 阿瓦隆图鉴数据源（静态构建一次）。 */
export const AVALON_ENCYCLOPEDIA_SOURCE: EncyclopediaRoleSource = {
  roles: AVALON_ROLES.map((roleId) => {
    const meta = getAvalonRoleMeta(roleId);
    const fields = toAvalonRoleDescriptionFields(meta.description);
    return {
      id: roleId,
      displayName: meta.displayName,
      factionKey: meta.isEvil ? 'evil' : 'good',
      factionLabel: meta.factionName,
      factionColorKey: meta.isEvil ? ('wolf' as const) : ('god' as const),
      searchText: [
        meta.displayName,
        meta.factionName,
        ...fields.map((field) => field.content),
      ].join(''),
      structuredFields: fields,
      listImage: getRoleAvatar(roleId),
      detailImage: getRoleAvatar(roleId),
    };
  }),
  factionGroups: [
    { key: 'good', label: '好人', colorKey: 'god' },
    { key: 'evil', label: '坏人', colorKey: 'wolf' },
  ],
};
