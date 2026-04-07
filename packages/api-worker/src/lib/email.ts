/**
 * email — Resend API 邮件发送封装
 *
 * 通过 Resend REST API 发送密码重置验证码邮件。
 * 纯 IO 模块，不含业务逻辑。
 */

import type { Env } from '../env';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = '狼人杀裁判 <noreply@send.werewolfjudge.eu.org>';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * 通过 Resend 发送邮件。
 * @throws 如果 Resend API 调用失败或未配置 API key
 */
export async function sendEmail(env: Env, options: SendEmailOptions): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

/**
 * 发送密码重置验证码邮件。
 */
export async function sendPasswordResetEmail(env: Env, email: string, code: string): Promise<void> {
  await sendEmail(env, {
    to: email,
    subject: `${code} 是你的密码重置验证码`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 24px;">密码重置验证码</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">你正在重置狼人杀裁判助手的密码，验证码为：</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
        </div>
        <p style="color: #888; font-size: 14px; line-height: 1.6;">
          验证码 15 分钟内有效。如果你没有请求重置密码，请忽略此邮件。
        </p>
      </div>
    `,
  });
}
