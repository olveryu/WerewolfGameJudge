/** Zod schemas for /auth/* endpoints */

import { z } from 'zod';

export const signUpSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
  displayName: z.string().max(30).optional(),
});

export const signInSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(30).optional(),
  avatarUrl: z.string().max(500).optional(),
  customAvatarUrl: z.string().max(500).optional(),
  avatarFrame: z.string().max(100).optional(),
  seatFlair: z.string().max(100).optional(),
  nameStyle: z.string().max(100).optional(),
  equippedEffect: z.string().max(100).optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.email().max(255),
});

export const resetPasswordSchema = z.object({
  email: z.email().max(255),
  code: z.string().min(1).max(10),
  newPassword: z.string().min(6).max(128),
});

export const wechatCodeSchema = z.object({
  code: z.string().min(1).max(200),
});
