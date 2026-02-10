/**
 * useAIChat - AI 聊天泡泡的全部状态与逻辑
 *
 * 包含：
 * - 游戏上下文构建（玩家视角，不作弊）
 * - 消息发送/接收/持久化
 * - 快捷问题生成（角色/上下文/跟进）
 * - 气泡拖动与位置持久化
 * - 键盘高度监听（Web visualViewport + Native Keyboard）
 * - 冷却倒计时
 *
 * ✅ 允许：管理聊天状态、构建游戏上下文、调用 AI API
 * ❌ 禁止：修改游戏状态、绕过 facade
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect,useRef, useState } from 'react';
import {
  Animated,
  type GestureResponderEvent,
  Keyboard,
  Platform,
  useWindowDimensions,
} from 'react-native';

import { useGameFacade } from '@/contexts';
import { ROLE_SPECS } from '@/models/roles';
import {
  type ChatMessage,
  type GameContext,
  getDefaultApiKey,
  sendChatMessage,
} from '@/services/feature/AIChatService';
import type { BroadcastGameState } from '@/services/protocol/types';
import { showAlert } from '@/utils/alert';
import { newRequestId } from '@/utils/id';
import { randomPick } from '@/utils/random';
import { shuffleArray } from '@/utils/shuffle';

import {
  BUBBLE_MARGIN,
  BUBBLE_SIZE,
  DEFAULT_POSITION,
  type DisplayMessage,
} from './AIChatBubble.styles';

// ── Storage keys ─────────────────────────────────────────

const STORAGE_KEY_MESSAGES = '@ai_chat_messages';
const STORAGE_KEY_POSITION = '@ai_chat_bubble_position';

// ── 冷却常量 ─────────────────────────────────────────────

const COOLDOWN_SECONDS = 5;

// ── 拖动判定阈值 ─────────────────────────────────────────

const DRAG_THRESHOLD = 10;

// ══════════════════════════════════════════════════════════
// Pure functions & data
// ══════════════════════════════════════════════════════════

/**
 * 从游戏状态构建玩家视角的上下文（不包含作弊信息）
 */
function buildPlayerContext(
  state: BroadcastGameState | null,
  mySeat: number | null,
): GameContext {
  if (!state) {
    return { inRoom: false };
  }

  const context: GameContext = {
    inRoom: true,
    roomCode: state.roomCode,
    status: state.status,
    totalPlayers: Object.values(state.players).filter(Boolean).length,
  };

  // 板子配置（公开信息 - 所有角色名称和技能）
  if (state.templateRoles && state.templateRoles.length > 0) {
    context.boardRoles = state.templateRoles.map((roleId) => {
      const roleSpec = ROLE_SPECS[roleId];
      return roleSpec?.displayName || roleId;
    });
    // 加入每个角色的详细技能描述
    context.boardRoleDetails = state.templateRoles.map((roleId) => {
      const roleSpec = ROLE_SPECS[roleId];
      return {
        name: roleSpec?.displayName || roleId,
        description: roleSpec?.description || '无描述',
      };
    });
  }

  // 我的座位和角色
  if (mySeat !== null && mySeat !== undefined) {
    context.mySeat = mySeat;
    const player = state.players[mySeat];
    if (player?.role) {
      context.myRole = player.role;
      const roleSpec = ROLE_SPECS[player.role];
      context.myRoleName = roleSpec?.displayName || player.role;
    }
  }

  // 当前阶段
  if (state.status === 'ongoing') {
    context.currentPhase = state.currentStepId ? `第一夜 - ${state.currentStepId}` : '第一夜';
  }

  // 注意：lastNightDeaths 是 Host 宣布后才公开的信息，AI 不应提前知道

  // 玩家自己知道的信息（只能看到自己该看到的）
  const myKnowledge: string[] = [];

  // 预言家的查验结果
  if (context.myRole === 'seer' && state.seerReveal) {
    myKnowledge.push(`${state.seerReveal.targetSeat + 1}号是${state.seerReveal.result}`);
  }

  // 通灵师的查验结果
  if (context.myRole === 'psychic' && state.psychicReveal) {
    myKnowledge.push(
      `${state.psychicReveal.targetSeat + 1}号的身份是${state.psychicReveal.result}`,
    );
  }

  // 女巫知道的信息
  if (context.myRole === 'witch' && state.witchContext) {
    if (state.witchContext.killedSeat >= 0) {
      myKnowledge.push(`今晚狼人刀了${state.witchContext.killedSeat + 1}号`);
    }
    const usedSkills: string[] = [];
    if (!state.witchContext.canSave) usedSkills.push('解药已用');
    if (!state.witchContext.canPoison) usedSkills.push('毒药已用');
    if (usedSkills.length > 0) {
      context.usedSkills = usedSkills;
    }
  }

  // 石像鬼的查验结果
  if (context.myRole === 'gargoyle' && state.gargoyleReveal) {
    myKnowledge.push(
      `${state.gargoyleReveal.targetSeat + 1}号的身份是${state.gargoyleReveal.result}`,
    );
  }

  // 机械狼的学习结果（加 defensive check 避免 targetSeat 不存在时拼出 NaN号）
  if (context.myRole === 'wolfRobot' && state.wolfRobotReveal?.targetSeat !== undefined) {
    const roleSpec = ROLE_SPECS[state.wolfRobotReveal.learnedRoleId];
    const roleName = roleSpec?.displayName || state.wolfRobotReveal.learnedRoleId;
    myKnowledge.push(
      `学习了${state.wolfRobotReveal.targetSeat + 1}号，获得了${roleName}的技能`,
    );
    if (state.wolfRobotReveal.learnedRoleId === 'hunter') {
      myKnowledge.push(
        `作为猎人${state.wolfRobotReveal.canShootAsHunter ? '可以' : '不能'}开枪`,
      );
    }
  }

  if (myKnowledge.length > 0) {
    context.myKnowledge = myKnowledge;
  }

  return context;
}

// ── 问题池 ───────────────────────────────────────────────

/** 通用问题池 - 不在游戏中时使用（≤10字） */
const GENERAL_QUESTIONS = [
  '狼人杀基本规则？',
  '好人怎么配合？',
  '狼人怎么隐藏？',
  '什么是金水银水？',
  '怎么分析发言？',
  '狼队怎么配合？',
  '怎么判断狼人？',
  '怎么保护神职？',
];

/** 根据角色生成相关问题（≤10字） */
const ROLE_QUESTIONS: Record<string, string[]> = {
  seer: ['预言家先查谁？', '预言家怎么自保？', '预言家何时跳？'],
  witch: ['女巫首晚要救吗？', '毒药什么时候用？', '女巫能自救吗？'],
  guard: ['守卫首晚守谁？', '守卫配合预言家？', '守卫能守自己吗？'],
  hunter: ['猎人何时开枪？', '被毒能开枪吗？', '猎人怎么发挥？'],
  wolf: ['狼人刀人技巧？', '狼人怎么伪装？', '刀完怎么发言？'],
  wolfQueen: ['狼王特殊技能？', '狼王能带人吗？'],
  wolfKing: ['狼王技能是啥？', '狼王何时自爆？'],
  nightmare: ['梦魇技能是啥？', '梦魇怎么配合？'],
  gargoyle: ['石像鬼技能？', '石像鬼看到啥？'],
  wolfRobot: ['机械狼技能？', '机械狼能互认？'],
  psychic: ['通灵师和预言家？', '通灵师怎么验？'],
  magician: ['魔术师技能？', '交换座位有啥用？'],
  idiot: ['白痴被投会怎样？', '翻牌后能投票吗？'],
  knight: ['骑士决斗怎么用？', '骑士何时翻牌？'],
  villager: ['村民怎么发挥？', '村民怎么发言？'],
  slacker: ['混子什么阵营？', '混子胜利条件？'],
};

/** 根据聊天记录中提到的关键词生成跟进问题（≤10字） */
const FOLLOW_UP_QUESTIONS: Record<string, string[]> = {
  预言家: ['预言家被刀咋办？', '验到狼怎么处理？', '第二晚查谁？'],
  女巫: ['解药什么时候用？', '女巫要不要自救？', '毒错人怎么办？'],
  守卫: ['守错人怎么办？', '能连续守一人吗？', '守卫女巫同救？'],
  猎人: ['猎人枪打谁好？', '猎人要暴露吗？', '被毒能开枪吗？'],
  狼人: ['狼人怎么悍跳？', '狼人怎么互保？', '狼人怎么发言？'],
  刀: ['狼刀什么策略？', '刀边和刀中？', '连刀还是跳刀？'],
  毒: ['毒药什么时候用？', '毒死好人咋办？', '该不该毒？'],
  救: ['第一晚要不要救？', '救人有啥风险？', '自救还是救队友？'],
  查: ['查谁效率高？', '查到好人咋办？', '查到狼要跳吗？'],
  跳: ['何时该跳身份？', '悍跳什么意思？', '被反驳怎么办？'],
  投票: ['首轮投票策略？', '怎么判断站边？', '弃票好不好？'],
  发言: ['好人怎么发言？', '狼人怎么发言？', '发言顺序重要吗？'],
  金水: ['金水怎么发言？', '金水被怀疑？', '假金水怎么辨别？'],
  银水: ['银水什么意思？', '银水可信吗？', '怎么用银水信息？'],
};

/** 通用跟进模板 */
const GENERIC_FOLLOW_UPS = [
  '继续说说？',
  '还有别的吗？',
  '具体怎么做？',
  '为什么呢？',
];

/**
 * 从聊天记录中提取关键词并生成跟进问题
 * 优先从 AI 最后的回答中提取关键词
 * 如果没有匹配到预设关键词，返回通用跟进问题
 */
function getContextQuestion(messages: DisplayMessage[]): string | null {
  // 只要有消息就返回跟进问题
  if (messages.length === 0) return null;

  // 优先取 AI 最后的回答
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const contentToAnalyze = lastAssistantMsg?.content || '';

  // 如果 AI 还没回答，取用户最后的问题
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const userContent = lastUserMsg?.content || '';

  // 合并分析
  const allContent = contentToAnalyze + ' ' + userContent;

  // 查找匹配的关键词（按优先级排序：越具体的关键词越优先）
  const matchedKeywords: string[] = [];
  for (const keyword of Object.keys(FOLLOW_UP_QUESTIONS)) {
    if (allContent.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  }

  // 如果匹配到预设关键词，返回对应跟进问题
  if (matchedKeywords.length > 0) {
    const sortedKeywords = [...matchedKeywords].sort((a, b) => b.length - a.length);
    const bestKeyword = sortedKeywords[0];
    const followUps = FOLLOW_UP_QUESTIONS[bestKeyword];
    return randomPick(followUps);
  }

  // 没有匹配到预设关键词 → 一律返回通用跟进问题（只要有对话）
  return randomPick(GENERIC_FOLLOW_UPS);
}

/**
 * 根据游戏上下文和聊天记录生成快捷问题（共4道）
 */
function generateQuickQuestions(
  state: BroadcastGameState | null,
  mySeat: number | null,
  messages: DisplayMessage[],
): string[] {
  const questions: string[] = [];
  const usedQuestions = new Set<string>();

  // 1. 根据聊天记录生成跟进问题（优先级最高）
  const contextQ = getContextQuestion(messages);
  if (contextQ && !usedQuestions.has(contextQ)) {
    questions.push(contextQ);
    usedQuestions.add(contextQ);
  }

  // 2. 固定问题：本局角色技能介绍（只在有板子时显示）
  const boardQ = '本局角色技能介绍？';
  if (
    state?.templateRoles &&
    state.templateRoles.length > 0 &&
    !usedQuestions.has(boardQ)
  ) {
    questions.push(boardQ);
    usedQuestions.add(boardQ);
  }

  // 3. 如果有我的角色，添加角色相关问题
  if (mySeat !== null && state?.players[mySeat]?.role) {
    const myRole = state.players[mySeat]?.role;
    if (myRole && ROLE_QUESTIONS[myRole]) {
      const roleQs = ROLE_QUESTIONS[myRole].filter((q) => !usedQuestions.has(q));
      if (roleQs.length > 0) {
        const randomRoleQ = randomPick(roleQs);
        questions.push(randomRoleQ);
        usedQuestions.add(randomRoleQ);
      }
    }
  }

  // 4. 根据板子里的其他角色添加问题
  if (
    state?.templateRoles &&
    state.templateRoles.length > 0 &&
    questions.length < 4
  ) {
    const otherRoles = state.templateRoles.filter((r) => {
      if (mySeat !== null && state.players[mySeat]?.role === r) return false;
      return ROLE_QUESTIONS[r] !== undefined;
    });
    const uniqueOtherRoles = [...new Set(otherRoles)];
    if (uniqueOtherRoles.length > 0) {
      const randomRole = randomPick(uniqueOtherRoles);
      const roleQs =
        ROLE_QUESTIONS[randomRole]?.filter((q) => !usedQuestions.has(q)) || [];
      if (roleQs.length > 0) {
        const randomQ = randomPick(roleQs);
        questions.push(randomQ);
        usedQuestions.add(randomQ);
      }
    }
  }

  // 5. 如果问题不够4个，从通用问题池补充
  if (questions.length < 4) {
    const remaining = 4 - questions.length;
    const availableGeneral = GENERAL_QUESTIONS.filter((q) => !usedQuestions.has(q));
    const shuffledGeneral = shuffleArray(availableGeneral);
    for (let i = 0; i < remaining && i < shuffledGeneral.length; i++) {
      questions.push(shuffledGeneral[i]);
    }
  }

  return questions.slice(0, 4);
}

// ══════════════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════════════

export interface UseAIChatReturn {
  // Chat state
  messages: DisplayMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  cooldownRemaining: number;
  aiSuggestions: string[];
  contextQuestions: string[];

  // Actions
  handleSend: () => Promise<void>;
  handleQuickQuestion: (question: string) => void;
  handleClearHistory: () => void;

  // Bubble position & drag
  position: { x: number; y: number };
  scaleAnim: Animated.Value;
  handleTouchStart: (e: GestureResponderEvent) => void;
  handleTouchMove: (e: GestureResponderEvent) => void;
  handleTouchEnd: () => void;
  handleBubblePress: () => void;

  // Keyboard
  keyboardHeight: number;
}

export function useAIChat(): UseAIChatReturn {
  const facade = useGameFacade();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // ── Animations ───────────────────────────────────────
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ── Drag state ───────────────────────────────────────
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);
  const justHandledTouchRef = useRef(false);

  // ── Chat state ───────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const apiKey = getDefaultApiKey();

  // AI 生成的跟进问题（从回复中解析）
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  // 上下文问题（缓存，只在打开时刷新）
  const [contextQuestions, setContextQuestions] = useState<string[]>([]);

  // AbortController: cancel in-flight AI request on close / unmount
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Cooldown ─────────────────────────────────────────
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // ── Keyboard ─────────────────────────────────────────
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ── Context questions refresh ────────────────────────
  const refreshContextQuestions = useCallback(
    (currentMessages: DisplayMessage[]) => {
      const gameState = facade.getState();
      const mySeat = facade.getMySeatNumber();
      const questions = generateQuickQuestions(gameState, mySeat, currentMessages);
      setContextQuestions(questions);
    },
    [facade],
  );

  // 只在打开聊天窗口时刷新上下文问题
  useEffect(() => {
    if (isOpen) {
      refreshContextQuestions(messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // 故意不依赖 messages，只在打开时刷新一次

  // ── Web keyboard (visualViewport) ────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || globalThis.window === undefined) {
      return;
    }

    const viewport = globalThis.window.visualViewport;
    if (!viewport) return;

    const initialHeight = globalThis.window.innerHeight;

    const handleViewportChange = () => {
      const kbHeight = initialHeight - viewport.height - viewport.offsetTop;
      setKeyboardHeight(Math.max(0, kbHeight));
    };

    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);
    return () => {
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  // ── Native keyboard ─────────────────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // ── Bubble press ─────────────────────────────────────
  const handleBubblePress = useCallback(() => {
    if (justHandledTouchRef.current) {
      justHandledTouchRef.current = false;
      return;
    }
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setIsOpen(true);
  }, [scaleAnim]);

  // ── Touch / drag handlers ────────────────────────────
  const handleTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      const touch = e.nativeEvent;
      dragStartRef.current = {
        x: touch.pageX,
        y: touch.pageY,
        posX: position.x,
        posY: position.y,
      };
      isDraggingRef.current = false;
      justHandledTouchRef.current = false;
    },
    [position],
  );

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const touch = e.nativeEvent;
    const dx = touch.pageX - dragStartRef.current.x;
    const dy = touch.pageY - dragStartRef.current.y;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      isDraggingRef.current = true;

      let newX = dragStartRef.current.posX + dx;
      let newY = dragStartRef.current.posY + dy;

      // 边界限制
      newX = Math.max(
        BUBBLE_MARGIN,
        Math.min(screenWidth - BUBBLE_SIZE - BUBBLE_MARGIN, newX),
      );
      newY = Math.max(
        BUBBLE_MARGIN + 50,
        Math.min(screenHeight - BUBBLE_SIZE - BUBBLE_MARGIN, newY),
      );

      setPosition({ x: newX, y: newY });
    }
  }, [screenWidth, screenHeight]);

  const handleTouchEnd = useCallback(() => {
    if (isDraggingRef.current) {
      AsyncStorage.setItem(
        STORAGE_KEY_POSITION,
        JSON.stringify(position),
      ).catch(() => {});
      justHandledTouchRef.current = true;
    } else {
      justHandledTouchRef.current = true;
      handleBubblePress();
    }
  }, [position, handleBubblePress]);

  // ── Load saved data ──────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedMessages, savedPosition] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MESSAGES),
          AsyncStorage.getItem(STORAGE_KEY_POSITION),
        ]);
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        }
        if (savedPosition) {
          const pos = JSON.parse(savedPosition);
          setPosition(pos);
        }
      } catch {
        // Storage read failed, use defaults
      }
    };
    loadData();
  }, []);

  // ── Persist messages ─────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      AsyncStorage.setItem(
        STORAGE_KEY_MESSAGES,
        JSON.stringify(messages.slice(-50)),
      ).catch(() => {});
    }
  }, [messages]);

  // ── Cooldown timer ───────────────────────────────────
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setTimeout(() => {
      setCooldownRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  // ── Send message ─────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text || isLoading) return;
      if (cooldownRemaining > 0) return;

      if (!apiKey) {
        showAlert('配置错误', 'AI 服务未配置');
        return;
      }

      setCooldownRemaining(COOLDOWN_SECONDS);

      // Cancel any in-flight request before starting a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMessage: DisplayMessage = {
        id: newRequestId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      let currentMessages: DisplayMessage[] = [];
      setMessages((prev) => {
        currentMessages = prev;
        return [...prev, userMessage];
      });
      setInputText('');
      setIsLoading(true);

      Keyboard.dismiss();

      try {
        const gameState = facade.getState();
        const mySeat = facade.getMySeatNumber();
        const gameContext = buildPlayerContext(gameState, mySeat);

        const contextMessages: ChatMessage[] = currentMessages
          .slice(-9)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));
        contextMessages.push({ role: 'user', content: text });

        const response = await sendChatMessage(
          contextMessages,
          apiKey,
          gameContext,
          controller.signal,
        );

        // If aborted while waiting, silently bail out
        if (controller.signal.aborted) return;

        if (response.success && response.message) {
          let content = response.message;

          // 移除 Qwen3 的 <think>...</think> 思考过程
          content = content.replaceAll(/<think>[\s\S]*?<\/think>/g, '').trim();

          // 解析 AI 返回的跟进建议
          const suggestionsRegex = /```suggestions\n([\s\S]*?)```/;
          const suggestionsMatch = suggestionsRegex.exec(content);
          if (suggestionsMatch) {
            const suggestions = suggestionsMatch[1]
              .split('\n')
              .map((s) => s.trim())
              .map((s) =>
                s.replace(/^\d+[.、)]\s*/, '').replace(/^[-*•]\s*/, ''),
              )
              .filter((s) => s.length > 0 && s.length <= 20)
              .map((s) =>
                s.endsWith('？') || s.endsWith('?') ? s : s + '？',
              );
            setAiSuggestions(suggestions.slice(0, 2));
            content = content
              .replace(/```suggestions\n[\s\S]*?```/, '')
              .trim();
          } else {
            setAiSuggestions([]);
          }

          const assistantMessage: DisplayMessage = {
            id: newRequestId(),
            role: 'assistant',
            content,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          refreshContextQuestions([
            ...currentMessages,
            userMessage,
            assistantMessage,
          ]);
        } else {
          showAlert('发送失败', response.error || '未知错误');
        }
      } catch (err: unknown) {
        // AbortError is expected when user closes chat — silently ignore
        if (err instanceof Error && err.name === 'AbortError') return;
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, cooldownRemaining, apiKey, facade, refreshContextQuestions],
  );

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    await sendMessage(text);
  }, [inputText, sendMessage]);

  const handleQuickQuestion = useCallback(
    (question: string) => {
      sendMessage(question);
    },
    [sendMessage],
  );

  // Wrap setIsOpen: abort in-flight request when closing chat panel
  const handleSetIsOpen = useCallback(
    (open: boolean) => {
      if (!open) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
      }
      setIsOpen(open);
    },
    [],
  );

  // Cleanup on unmount: abort any in-flight request
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const handleClearHistory = useCallback(() => {
    showAlert('清除聊天记录', '确定要清除所有聊天记录吗？此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: () => {
          setMessages([]);
          setAiSuggestions([]);
          AsyncStorage.removeItem(STORAGE_KEY_MESSAGES).catch(() => {});
        },
      },
    ]);
  }, []);

  // ── Return ───────────────────────────────────────────

  return {
    messages,
    inputText,
    setInputText,
    isLoading,
    isOpen,
    setIsOpen: handleSetIsOpen,
    cooldownRemaining,
    aiSuggestions,
    contextQuestions,

    handleSend,
    handleQuickQuestion,
    handleClearHistory,

    position,
    scaleAnim,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleBubblePress,

    keyboardHeight,
  };
}
