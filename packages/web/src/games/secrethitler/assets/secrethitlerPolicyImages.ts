/**
 * 秘密希特勒法案牌插画的静态地址：自由派法案牌、法西斯法案牌。
 * 两张随进房间由共享 useRoomImagePreload 一次预加载（见 useSecrethitlerRoomState）。
 */
import fascistPolicyImage from '@/assets/secrethitler-policy/fascist-policy.webp';
import liberalPolicyImage from '@/assets/secrethitler-policy/liberal-policy.webp';

export const secrethitlerPolicyLiberalImage = liberalPolicyImage;
export const secrethitlerPolicyFascistImage = fascistPolicyImage;

/** 立法手牌的全部插画：进房间预加载的完整清单。 */
export const SECRETHITLER_POLICY_IMAGES: readonly string[] = [
  liberalPolicyImage,
  fascistPolicyImage,
];
