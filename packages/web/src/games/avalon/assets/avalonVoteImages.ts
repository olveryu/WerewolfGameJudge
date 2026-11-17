/**
 * 阿瓦隆投票 / 出牌插画的静态地址：赞成白币、反对黑币、成功金杯、失败黑杯。
 * 全部 4 张随进房间由共享 useRoomImagePreload 一次预加载（见 useAvalonRoomState）。
 */
import approveImage from '@/assets/avalon-vote/approve.webp';
import failImage from '@/assets/avalon-vote/fail.webp';
import rejectImage from '@/assets/avalon-vote/reject.webp';
import successImage from '@/assets/avalon-vote/success.webp';

export const avalonVoteApproveImage = approveImage;
export const avalonVoteRejectImage = rejectImage;
export const avalonVoteSuccessImage = successImage;
export const avalonVoteFailImage = failImage;

/** 投票 / 出牌的全部插画：进房间预加载的完整清单。 */
export const AVALON_VOTE_IMAGES: readonly string[] = [
  approveImage,
  rejectImage,
  successImage,
  failImage,
];
