import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export const redeemSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{48}$/),
  displayName: z.string().trim().min(1, "Vui lòng nhập tên hiển thị").max(120),
  email: z.email("Email chưa hợp lệ").max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(10, "Mật khẩu cần ít nhất 10 ký tự").max(200),
});

export const inviteSchema = z.object({
  email: z.union([z.literal(""), z.email().max(254)]).transform((v) => (v ? v.toLowerCase() : null)),
  role: z.enum(["family_admin", "branch_admin", "member", "guest"]),
  branchId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
  ttlHours: z.coerce.number().int().min(1).max(720),
  // 1 = moi rieng 1 nguoi nhu cu; 50 = lien ket dung chung cho ca nha.
  maxUses: z.coerce.number().int().min(1).max(50).default(1),
});

export const familySettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  primaryColor: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)]).transform((v) => v || null),
  timezone: z.string().refine((tz) => {
    try { new Intl.DateTimeFormat("vi-VN", { timeZone: tz }); return true; } catch { return false; }
  }, "Múi giờ không hợp lệ"),
});

export const editingSchema = z.object({
  scope: z.union([z.literal("family"), z.uuid()]),
  mode: z.enum(["locked", "open"]),
  hours: z.coerce.number().int().min(0).max(24 * 60),
});

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  aliasName: z.string().trim().max(80).optional().default(""),
});
export const branchSchema = z.object({ name: z.string().trim().min(1).max(120), parentId: z.union([z.literal(""), z.uuid()]).transform((v) => v || null) });

export type FormState = { error?: string; ok?: string; link?: string } | null;
