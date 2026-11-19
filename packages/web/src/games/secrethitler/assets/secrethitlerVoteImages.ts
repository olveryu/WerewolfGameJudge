/**
 * 秘密希特勒投票 / 结算插画的静态地址：赞成蓝卡、反对红卡、通过金票箱、失败翻倒票箱。
 * 全部 4 张随进房间由共享 useRoomImagePreload 一次预加载（见 useSecrethitlerRoomState）。
 */
import failImage from '@/assets/secrethitler-vote/fail.webp';
import noImage from '@/assets/secrethitler-vote/no.webp';
import passImage from '@/assets/secrethitler-vote/pass.webp';
import yesImage from '@/assets/secrethitler-vote/yes.webp';

export const secrethitlerVoteYesImage = yesImage;
export const secrethitlerVoteNoImage = noImage;
export const secrethitlerVotePassImage = passImage;
export const secrethitlerVoteFailImage = failImage;

/** 投票 / 结算的全部插画：进房间预加载的完整清单。 */
export const SECRETHITLER_VOTE_IMAGES: readonly string[] = [
  yesImage,
  noImage,
  passImage,
  failImage,
];
