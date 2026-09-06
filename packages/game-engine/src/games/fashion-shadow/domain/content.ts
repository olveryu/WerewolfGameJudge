// Data-driven Fashion Shadow roles, events, and evidence from the supplied rule documents.

import type {
  FashionEventId,
  FashionEvidenceId,
  FashionRoleId,
  FashionRound,
  FashionSecretId,
} from '../state/types';

export interface FashionRoleDefinition {
  readonly id: FashionRoleId;
  readonly name: string;
  readonly publicStance: string;
  readonly secretId: FashionSecretId;
  readonly secret: string;
  readonly victoryCondition: string;
}

export const FASHION_ROLE_BY_ID: Readonly<Record<FashionRoleId, FashionRoleDefinition>> = {
  journalist: {
    id: 'journalist',
    name: '記者',
    publicStance: '我要揭發 VELA 標籤造假的真相',
    secretId: 'journalistFormerEmployerAdPressure',
    secret: '前東家曾收 VELA 廣告費壓報導，怕被說「媒體被收買」。',
    victoryCondition: '反派被定罪，且至少 2 張證據卡被公開。',
  },
  governmentOfficial: {
    id: 'governmentOfficial',
    name: '政府官員',
    publicStance: '在不影響市場秩序下妥善處理',
    secretId: 'governmentOfficialInspectionFavor',
    secret: '3 年前對 VELA 工廠檢查「放水」，怕被追究瀆職。',
    victoryCondition:
      '最終聽證會的定罪／脫罪結果與個人在四輪調查投票的整體傾向一致，且放水歷史未被公開。',
  },
  consumerRepresentative: {
    id: 'consumerRepresentative',
    name: '消費者代表',
    publicStance: '為消費者討回公道，要求賠償',
    secretId: 'consumerRepresentativeVelaSponsorship',
    secret: '去年收過 VELA 贊助參加論壇，怕被說「扮正義」。',
    victoryCondition: '至少一次被選為該輪最佳攻防者，且贊助歷史未被公開。',
  },
  factoryWorker: {
    id: 'factoryWorker',
    name: '工廠工人',
    publicStance: '討回欠薪，改善工廠環境',
    secretId: 'factoryWorkerSignedRelabelInstruction',
    secret: '持有反派簽名的「更換標籤指令」複印件。',
    victoryCondition: '成功與買家簽訂契約卡；最終結算時買家獲勝且契約卡生效。',
  },
  brandExecutive: {
    id: 'brandExecutive',
    name: '品牌方（高層）',
    publicStance: '掩蓋醜聞，保住 VELA 形象',
    secretId: 'brandExecutiveKnewLabelProblem',
    secret: '早就知道標籤有問題但沉默，怕被視為共犯。',
    victoryCondition: '反派被定罪，且自己未被任何公開證據卡的內容指認為共犯。',
  },
  villainProcurementDirector: {
    id: 'villainProcurementDirector',
    name: '反派（採購總監）',
    publicStance: '對外宣稱「採購部門失誤」',
    secretId: 'villainMastermind',
    secret: '所有造假都是他親手策劃的。',
    victoryCondition: '最終聽證會未被定罪（脫罪）。',
  },
  supplierOwner: {
    id: 'supplierOwner',
    name: '供應商（布行老闆）',
    publicStance: '自保，不成為代罪羔羊',
    secretId: 'supplierOwnerOriginalOrdersAndBreach',
    secret: '持有「原始訂單與發票」，可證明 VELA 長期要求改標；自己有供應次級布的違約歷史。',
    victoryCondition: '最後一次投票立場與最終結果一致，且自己的違約歷史未被公開。',
  },
};

export interface FashionRoundDefinition {
  readonly round: FashionRound;
  readonly location: string;
  readonly esg: 'S' | 'E' | 'G';
  readonly eventId: FashionEventId;
  readonly eventTitle: string;
  readonly eventDescription: string;
  readonly voteQuestion: string;
  readonly evidenceId: FashionEvidenceId;
  readonly evidenceTitle: string;
  readonly implicatedRoles: readonly FashionRoleId[];
  readonly mainCrossExam: readonly [FashionRoleId, FashionRoleId];
}

export const FASHION_ROUND_BY_NUMBER: Readonly<Record<FashionRound, FashionRoundDefinition>> = {
  1: {
    round: 1,
    location: '深水埗',
    esg: 'S',
    eventId: 'E1',
    eventTitle: '深水埗布市場的線人',
    eventDescription:
      '深水埗布市場的老裁縫根叔指控 VELA 長期要求將普通 TC 布標籤改為「100%有機棉」，並保留舊訂單與布辦。',
    voteQuestion: '是否派出調查小組前往深水埗，取得根叔手上的訂單與布辦樣本？',
    evidenceId: 'V1',
    evidenceTitle: '裁縫師傅的證詞',
    implicatedRoles: [],
    mainCrossExam: ['factoryWorker', 'brandExecutive'],
  },
  2: {
    round: 2,
    location: '大埔',
    esg: 'E',
    eventId: 'E2',
    eventTitle: '大埔工業邨的排污報告',
    eventDescription: 'VELA 二號廠房的內部排污檢測報告顯示多項污染物嚴重超標，但從未公開。',
    voteQuestion: '是否正式要求環保署公開 VELA 二號廠房的排污檢測報告？',
    evidenceId: 'V2',
    evidenceTitle: '廢水超標化驗單',
    implicatedRoles: [],
    mainCrossExam: ['governmentOfficial', 'villainProcurementDirector'],
  },
  3: {
    round: 3,
    location: '葵涌',
    esg: 'G',
    eventId: 'E3',
    eventTitle: '葵涌貨櫃碼頭的目擊者',
    eventDescription: '碼頭保安指控 VELA 長期將申報重量調整為實際重量約七成。',
    voteQuestion: '是否授權調查小組調閱葵涌貨櫃碼頭的 VELA 貨櫃出入記錄？',
    evidenceId: 'V3',
    evidenceTitle: '貨櫃入閘紀錄',
    implicatedRoles: [],
    mainCrossExam: ['journalist', 'brandExecutive'],
  },
  4: {
    round: 4,
    location: '中環',
    esg: 'G',
    eventId: 'E4',
    eventTitle: '中環財務顧問的「抽水」記錄',
    eventDescription: '80 萬港元「顧問費」匯至空殼公司，再於一週內轉至離岸戶口。',
    voteQuestion: '是否要求銀行提供 VELA 可疑轉賬的詳細記錄？',
    evidenceId: 'V4',
    evidenceTitle: '顧問費轉賬記錄',
    implicatedRoles: [],
    mainCrossExam: ['journalist', 'villainProcurementDirector'],
  },
};

export const FASHION_NEXT_ROUND: Readonly<Record<FashionRound, FashionRound | null>> = {
  1: 2,
  2: 3,
  3: 4,
  4: null,
};

export function getFashionRoleDefinition(roleId: FashionRoleId): FashionRoleDefinition {
  return FASHION_ROLE_BY_ID[roleId];
}
