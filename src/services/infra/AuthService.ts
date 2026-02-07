import { supabase, isSupabaseConfigured } from '../../config/supabase';
import { authLog } from '../../utils/logger';
import { getAllRoleIds, getRoleSpec } from '../../models/roles';
import { withTimeout } from '../../utils/withTimeout';

/**
 * AuthService - Supabase 匿名认证服务
 *
 * 职责：
 * - 管理匿名用户的 sign-in / session 恢复
 * - 提供当前 userId（uid）
 * - 管理用户昵称和头像元数据
 *
 * ✅ 允许：Supabase Auth API 调用 + 用户元数据管理
 * ❌ 禁止：游戏逻辑 / 游戏状态存储
 */
export class AuthService {
  private static instance: AuthService;
  private currentUserId: string | null = null;
  private readonly initPromise: Promise<void>;

  private constructor() {
    // Note: async operation in constructor is intentional for singleton initialization
    // The promise is stored and can be awaited via ensureInitialized()
    this.initPromise = this.autoSignIn();
  }

  private async autoSignIn(): Promise<void> {
    if (!this.isConfigured()) return;

    try {
      const existingUserId = await this.initAuth();
      if (existingUserId) {
        authLog.info(' Restored session:', existingUserId);
        return;
      }

      const userId = await this.signInAnonymously();
      authLog.info(' Auto signed in anonymously:', userId);
    } catch (error) {
      authLog.error(' Auto sign in failed:', error);
    }
  }

  async waitForInit(): Promise<void> {
    // Add timeout to prevent infinite waiting
    // 使用用户友好的错误消息，技术上下文由 withTimeout 内部 logger 记录
    await withTimeout(this.initPromise, 10000, () => new Error('登录超时，请重试'));
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Please set up Supabase or use demo mode.');
    }
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  getCurrentUser() {
    if (!this.isConfigured()) return null;
    return supabase!.auth.getUser();
  }

  async signInAnonymously(): Promise<string> {
    this.ensureConfigured();
    const { data, error } = await supabase!.auth.signInAnonymously();
    if (error) throw error;
    this.currentUserId = data.user?.id || null;
    return this.currentUserId || '';
  }

  async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ userId: string; user: any }> {
    this.ensureConfigured();
    const { data, error } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
        },
        emailRedirectTo: undefined,
      },
    });
    if (error) throw error;
    this.currentUserId = data.user?.id || null;

    return {
      userId: this.currentUserId || '',
      user: data.user,
    };
  }

  async signInWithEmail(email: string, password: string): Promise<string> {
    this.ensureConfigured();
    const { data, error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    this.currentUserId = data.user?.id || null;
    return this.currentUserId || '';
  }

  async updateProfile(updates: { displayName?: string; avatarUrl?: string }): Promise<void> {
    this.ensureConfigured();
    const { error } = await supabase!.auth.updateUser({
      data: {
        display_name: updates.displayName,
        avatar_url: updates.avatarUrl,
      },
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    this.ensureConfigured();
    await supabase!.auth.signOut();
    this.currentUserId = null;
  }

  async initAuth(): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const {
      data: { session },
    } = await supabase!.auth.getSession();
    if (session?.user) {
      this.currentUserId = session.user.id;
      return this.currentUserId;
    }
    return null;
  }

  // Generate a random display name based on user ID hash
  generateDisplayName(uid: string): string {
    const adjectives = [
      '快乐',
      '勇敢',
      '聪明',
      '神秘',
      '可爱',
      '酷炫',
      '狡猾',
      '正义',
      '机智',
      '沉稳',
      '热血',
      '冷静',
      '傲娇',
      '呆萌',
      '腹黑',
      '高冷',
      '温柔',
      '霸气',
      '淡定',
      '暴躁',
      '憨厚',
      '精明',
      '天真',
      '老练',
      '迷糊',
      '清醒',
      '困倦',
      '亢奋',
      '悠闲',
      '忙碌',
      '饥饿',
      '满足',
      '微醺',
      '元气',
      '慵懒',
      '活泼',
      '安静',
      '躁动',
      '专注',
      '发呆',
      '优雅',
      '野性',
      '文艺',
      '朋克',
      '复古',
      '未来',
      '古典',
      '摇滚',
      '甜美',
      '辛辣',
      '清新',
      '浓郁',
      '梦幻',
      '现实',
      '浪漫',
      '理性',
      '超级',
      '无敌',
      '绝世',
      '传说',
      '史诗',
      '究极',
      '至尊',
      '王者',
    ];
    const nouns = getAllRoleIds().map((id) => getRoleSpec(id).displayName);

    const chars = uid.split('');
    const hash1 = chars.reduce((acc, char, i) => acc + (char.codePointAt(0) || 0) * (i + 1), 0);
    const hash3 = chars.reduce((acc, char) => acc ^ (char.codePointAt(0) || 0), 0) * 31;

    const idx1 = Math.abs(hash1) % adjectives.length;
    const idx3 = Math.abs(hash3) % nouns.length;

    return adjectives[idx1] + nouns[idx3];
  }

  // Get current user's display name
  async getCurrentDisplayName(): Promise<string> {
    if (!this.isConfigured()) {
      return this.generateDisplayName(this.currentUserId || 'anonymous');
    }

    try {
      const { data } = await supabase!.auth.getUser();
      const registeredName = data.user?.user_metadata?.display_name;
      if (registeredName) {
        return registeredName;
      }
    } catch {
      // Fall through to generated name
    }

    return this.generateDisplayName(this.currentUserId || 'anonymous');
  }

  // Get current user's avatar URL
  async getCurrentAvatarUrl(): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const { data } = await supabase!.auth.getUser();
      return data.user?.user_metadata?.avatar_url || null;
    } catch {
      return null;
    }
  }
}

export default AuthService;
