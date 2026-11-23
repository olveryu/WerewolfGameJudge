/**
 * 秘密希特勒投票插画的静态地址：赞成蓝卡、反对红卡。
 * 进房间由共享 useRoomImagePreload 预加载（见 useSecrethitlerRoomState）。
 */
import noImage from '@/assets/secrethitler-vote/no.webp';
import yesImage from '@/assets/secrethitler-vote/yes.webp';

export const secrethitlerVoteYesImage = yesImage;
export const secrethitlerVoteNoImage = noImage;

/** 投票 / 结算的全部插画：进房间预加载的完整清单。 */
export const SECRETHITLER_VOTE_IMAGES: readonly string[] = [yesImage, noImage];
