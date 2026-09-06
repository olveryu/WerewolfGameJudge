export type FashionTutorialDocumentId = 'social' | 'environment' | 'governance';
export type FashionTutorialDecisionId = 'transparent' | 'internal' | 'board';

export interface FashionTutorialDocument {
  readonly id: FashionTutorialDocumentId;
  readonly option: 'A' | 'B' | 'C';
  readonly esg: 'S' | 'E' | 'G';
  readonly esgName: '社会' | '环境' | '治理';
  readonly title: string;
  readonly decisionLabel: string;
  readonly documentLines: readonly string[];
  readonly feedbackLines: readonly string[];
  readonly clue: string;
  readonly knowledgeDefinition: string;
  readonly caseStudy: string;
}

export interface FashionTutorialDecision {
  readonly id: FashionTutorialDecisionId;
  readonly option: 'A' | 'B' | 'C';
  readonly label: string;
  readonly consequence: string;
  readonly endingTitle: string;
  readonly endingLines: readonly string[];
  readonly badge: string;
  readonly lesson: string;
  readonly caseStudy: string;
}

export const FASHION_TUTORIAL_INTRO_LINES = [
  '2026 年 1 月，你第一天走进 VELA 集团的永续长办公室。上一任永续长三个月前「因健康因素」离职，办公桌抽屉里留下一个牛皮纸信封：给下一任——你最好知道真相。',
  '信封里有三份互相牵连的文件。你只有 15 分钟的游戏内时间，然后就要参加第一次供应链会议。你必须决定：先调查哪一个环节？',
] as const;

export const FASHION_TUTORIAL_DOCUMENTS: readonly FashionTutorialDocument[] = [
  {
    id: 'social',
    option: 'A',
    esg: 'S',
    esgName: '社会',
    title: '《深水埗布市场的订单备注》',
    decisionLabel: '先查深水埗布料采购（追踪标签造假的源头）',
    documentLines: [
      '「新昌布行」2024 年 11 月订单，编号 VELA-PO-2024-1203。订货布料：TC 布（65% 聚酯纤维 + 35% 棉）。',
      '采购总监亲笔备注：「成本压缩，布质不变，标签统一印『100%有机棉』。」',
      '根叔留下便条：他把原始订单影印留底，不想继续配合 VELA 欺骗消费者，但要求不要公开他的身份。',
    ],
    feedbackLines: [
      '你打给深水埗的根叔。他沉默很久，只说：「你终于打来喇。我等你呢个电话，等咗三年。」',
      '根叔约你翌日在布市场后巷见面，会把原始订单和布办样本交给你，但要求保护他的身份。',
    ],
    clue: '根叔的订单碎片（可对应正式证据 V1《裁缝师傅的证词》）',
    knowledgeDefinition:
      '社会（S）关注供应链中的权力不对等、强迫劳动、剥削与吹哨者保护。小型供应商和工人往往没有拒绝品牌要求的议价能力。',
    caseStudy:
      '剧本提供的案例对照指出，快时尚供应链中的超长工时、低薪与保密压力，会把商业风险转嫁给最弱势的生产者。',
  },
  {
    id: 'environment',
    option: 'B',
    esg: 'E',
    esgName: '环境',
    title: '《大埔工业邨的内部检测报告》',
    decisionLabel: '先查大埔工厂排污（追踪环境污染的证据）',
    documentLines: [
      'VELA 二号厂房废水检测，内部存档且从未公开。',
      '镍：4.8 mg/L（法定上限 1.0）；铬：3.2 mg/L（法定上限 0.8）；COD：850 mg/L（法定上限 150）。',
      '手写备忘录写着：「呢份报告唔可以出街。环保署嚟查嘅时候，畀另一份『调整过』嘅报告就得。」',
    ],
    feedbackLines: [
      '你致电厂长。他明显紧张，并劝你不要把事情闹大，理由是工厂养活数百个家庭。',
      '你随后查到附近居民从 2023 年开始持续投诉半夜异味与皮肤问题，却一直没有形成公开报道。',
    ],
    clue: '内部检测报告副本（可对应正式证据 V2《废水超标化验单》）',
    knowledgeDefinition:
      '环境（E）关注企业生产活动对空气、水、土壤，以及工厂周边居民等外部人群造成的损害。环境成本不能只留在企业账外。',
    caseStudy:
      '剧本用废水超标与居民投诉说明：当违规成本低于改善设备的成本时，企业可能选择把环境成本继续转嫁给社会。',
  },
  {
    id: 'governance',
    option: 'C',
    esg: 'G',
    esgName: '治理',
    title: '《葵涌货柜码头的重量纪录》',
    decisionLabel: '先查葵涌货柜申报（追踪系统性欺诈的证据）',
    documentLines: [
      '葵涌货柜码头地磅记录显示：2025/09/14，申报 8,500 kg，实际 12,300 kg；2025/11/03，申报 7,200 kg，实际 11,800 kg；2026/01/17，申报 9,000 kg，实际 14,100 kg。',
      '码头保安陈 Sir 留下名片：VELA 的货柜经常半夜出入，报关重量每次都少约三成，他保留了监控录像，但要求保证他的工作安全。',
    ],
    feedbackLines: [
      '你发现三笔记录都存在持续、方向一致的重量差异，不像单次录入错误。',
      '陈 Sir 告诉你，他录了三个月监控，愿意在码头后门交给你，但要求绝不能暴露来源。',
    ],
    clue: '货柜出入闸监控记录（可对应正式证据 V3《货柜入闸纪录》）',
    knowledgeDefinition:
      '治理（G）关注管理层是否诚实、内部控制能否防止欺诈，以及财报、申报文件和环保数据能否经得起独立检验。系统性说谎本身就是治理失灵。',
    caseStudy:
      '剧本以误导性永续声明为案例对照：企业若无法用可核验数据支持自己的公开承诺，就可能不是单一错误，而是系统性治理问题。',
  },
] as const;

export const FASHION_TUTORIAL_FINAL_PROMPT =
  '品牌方高层要求你把这些「历史文件」交回公司内部处理，并强调外面的人不需要知道那么多。你会怎么回应？';

export const FASHION_TUTORIAL_DECISIONS: readonly FashionTutorialDecision[] = [
  {
    id: 'transparent',
    option: 'A',
    label: '「这些文件我会公开给所有利害关系人。透明度是永续的基础。」',
    consequence: '得罪品牌方，但获得记者与消费者代表的信任。',
    endingTitle: '结局 A · 公开透明',
    endingLines: [
      '记者站起来鼓掌，消费者代表对你点头；品牌方高层脸色铁青，采购总监冷笑了一下。',
      '两个月后调查报告公开，VELA 面临强烈市场与管理层压力；你也收到匿名警告。',
    ],
    badge: '成就：吹哨者',
    lesson:
      '你选择了治理（G）中的高透明度标准。ESG 的核心不只是避免犯错，也包括问题发生后是否愿意面对、披露并承担后果。',
    caseStudy: '剧本以 Patagonia 的治理安排作为透明度与使命约束的对照案例。',
  },
  {
    id: 'internal',
    option: 'B',
    label: '「我先内部调查，再决定下一步。给我两周时间。」',
    consequence: '暂时不得罪任何人，但证据可能被「内部处理」。',
    endingTitle: '结局 B · 内部调查，暂不公开',
    endingLines: [
      '品牌方高层松了一口气。两周后，你准备公开报告的前一天，公司通知你的电脑硬盘故障，所有资料遗失。',
      '一年后你离开公司，根叔打来电话说，他留下的订单也已经没有了。',
    ],
    badge: '警告：被沉默的代价',
    lesson:
      '「内部调查」听起来合理，但在失灵的治理结构中，可能成为拖延、调整证据、施压吹哨者和消化外部压力的机制。',
    caseStudy: '剧本以 Boohoo 供应链争议作为「长期内部处理会扩大治理风险」的案例对照。',
  },
  {
    id: 'board',
    option: 'C',
    label: '「这些文件涉及敏感资讯，我需要请示董事会才能决定。」',
    consequence: '拖延时间，让可能涉事的人有机会处理关键证据。',
    endingTitle: '结局 C · 请示董事会',
    endingLines: [
      '董事会三天后回复：文件证据力不足，建议不予公开。你随后发现报告中的数据已经被调整，你的签名也出现在同意栏位。',
      '你终于明白，上一任永续长为什么会以「健康因素」离职。',
    ],
    badge: '警告：被共犯化的代价',
    lesson:
      '把问题向上汇报不等于问题一定会被解决。当治理（G）本身已经腐败，董事会或内部专案组也可能属于利益冲突结构。',
    caseStudy:
      '剧本用「调查小组全部来自品牌方和供应商、缺少外部独立人士」说明形式上的治理程序不等于独立监督。',
  },
] as const;

export const FASHION_TUTORIAL_CLOSING_LINES = [
  '你走出会议室，手机响了。陈 Sir 告诉你，无论刚才选择了哪条路，他都支持愿意追查真相的人。',
  '电话挂断。你站在 VELA 集团的玻璃幕墙前，看着香港街道——这场仗才刚开始。',
] as const;

export const FASHION_TUTORIAL_LEARNING_SUMMARY = [
  'E / S / G 是三种不同的调查视角；正式游戏每轮事件都会对应 ESG 面向。',
  '证据背后往往有吹哨者或线人，公开证据也会让相关人承担风险。',
  '你的选择会改变调查方向和后果；正式游戏用每轮投票决定证据能否进入公共证据区。',
  '「内部处理」可能意味着证据消失；正式游戏中调查未通过的证据会永久销毁。',
  '每位正式角色都有公开立场、隐藏秘密与独立胜利条件。',
] as const;

export function getFashionTutorialDocument(id: FashionTutorialDocumentId): FashionTutorialDocument {
  const document = FASHION_TUTORIAL_DOCUMENTS.find((candidate) => candidate.id === id);
  if (document === undefined)
    throw new Error(`[FAIL-FAST] Unknown Fashion tutorial document: ${id}`);
  return document;
}

export function getFashionTutorialDecision(id: FashionTutorialDecisionId): FashionTutorialDecision {
  const decision = FASHION_TUTORIAL_DECISIONS.find((candidate) => candidate.id === id);
  if (decision === undefined)
    throw new Error(`[FAIL-FAST] Unknown Fashion tutorial decision: ${id}`);
  return decision;
}
