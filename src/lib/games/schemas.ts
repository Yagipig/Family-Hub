// Kiem tra dau vao (zod) cho module tro choi. Chi nhan SO NGUYEN diem ao; khong co truong tien te.
import { z } from "zod";
import { CUSTOM_COIN_ICONS, isCoinUnitKey } from "@/lib/coins";

/** Loai xu hien thi (quan tri chon): key trong danh muc, hoac "custom" kem ten + bieu tuong. */
export const coinSchema = z
  .object({
    unit: z.string().refine(isCoinUnitKey, "Loại xu không hợp lệ"),
    customName: z.string().trim().max(30, "Tên xu tối đa 30 ký tự").optional().default(""),
    customIcon: z.string().optional().default(""),
  })
  .refine((v) => v.unit !== "custom" || v.customName.length >= 1, "Hãy đặt tên cho loại xu tự đặt")
  .refine(
    (v) => v.unit !== "custom" || (CUSTOM_COIN_ICONS as readonly string[]).includes(v.customIcon),
    "Hãy chọn biểu tượng cho loại xu tự đặt",
  );

const int = (min: number, max: number, msg: string) =>
  z.coerce.number().int(msg).min(min, msg).max(max, msg);

export const gameSettingsSchema = z
  .object({
    enabled: z.boolean(),
    leaderboard: z.boolean(),
    startingPoints: int(0, 1000, "Điểm khởi đầu từ 0 đến 1000"),
    dailyGift: int(0, 100, "Quà hằng ngày từ 0 đến 100"),
    bcMin: int(1, 100, "Cược tối thiểu từ 1 đến 100"),
    bcMax: int(1, 200, "Cược tối đa mỗi ô từ 1 đến 200"),
    bcRound: int(1, 500, "Tổng cược mỗi ván từ 1 đến 500"),
    lossCap: int(1, 1000, "Hạn mức thua mỗi ngày từ 1 đến 1000"),
    winCap: int(1, 5000, "Hạn mức thắng mỗi ngày từ 1 đến 5000"),
  })
  .refine((v) => v.bcMin <= v.bcMax && v.bcMax <= v.bcRound, "Cần: cược tối thiểu ≤ tối đa mỗi ô ≤ tổng mỗi ván");

const title = z.string().trim().min(1, "Vui lòng nhập tên").max(120, "Tên tối đa 120 ký tự");

/** "5, 10, 20" hoac moi dong mot so -> [5,10,20] (1..500, toi da 50 phan). */
export const prizeListSchema = z
  .string()
  .transform((s) => s.split(/[\s,;]+/).filter(Boolean))
  .pipe(
    z
      .array(z.string().regex(/^\d{1,3}$/, "Mỗi phần thưởng là một số điểm nguyên"))
      .min(1, "Cần ít nhất 1 phần thưởng")
      .max(50, "Tối đa 50 phần thưởng"),
  )
  .transform((a) => a.map(Number))
  .pipe(z.array(z.number().int().min(1, "Mỗi phần từ 1 đến 500 điểm").max(500, "Mỗi phần từ 1 đến 500 điểm")));

export const lixiCreateSchema = z.object({
  title,
  prizes: prizeListSchema,
  closeHours: int(0, 24 * 60, "Giờ tự đóng không hợp lệ"),
});

export const lotteryPrizeSchema = z.object({
  kind: z.enum(["points", "wish", "item"]),
  label: z.string().trim().min(1).max(120),
  points: z.coerce.number().int().min(1).max(500).optional(),
});

export const lotteryOpenSchema = z.object({
  title,
  drawAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Vui lòng chọn ngày giờ quay"),
  price: int(0, 50, "Giá vé từ 0 đến 50 điểm"),
  free: int(0, 3, "Vé miễn phí từ 0 đến 3"),
  max: int(1, 5, "Tối đa từ 1 đến 5 vé"),
  prizes: z.array(lotteryPrizeSchema).min(1, "Cần ít nhất 1 giải").max(20),
}).refine((v) => v.free <= v.max, "Vé miễn phí không được nhiều hơn tối đa mỗi người");

/** Doc cac hang giai tu form: prizeKind/prizeLabel/prizePoints lap lai; bo qua hang bo trong nhan. */
export function readLotteryPrizes(fd: FormData): Array<{ kind: string; label: string; points?: string }> {
  const kinds = fd.getAll("prizeKind").map(String);
  const labels = fd.getAll("prizeLabel").map(String);
  const pts = fd.getAll("prizePoints").map(String);
  const out: Array<{ kind: string; label: string; points?: string }> = [];
  for (let i = 0; i < labels.length; i++) {
    if (!labels[i].trim()) continue;
    const kind = kinds[i] ?? "wish";
    out.push({ kind, label: labels[i], ...(kind === "points" ? { points: pts[i] } : {}) });
  }
  return out;
}

export const lotoRoomSchema = z.object({ title, prize: int(0, 500, "Giải kinh từ 0 đến 500 điểm") });
const stakeField = z.coerce.number().int().refine(
  (n) => [1000, 2000, 5000, 10000, 20000, 50000].includes(n),
  "Mức cược phải là một mệnh giá: 1.000, 2.000, 5.000, 10.000, 20.000 hoặc 50.000",
);
export const lotoJoinSchema = z.object({ roomId: z.uuid(), cards: int(1, 3, "Chọn từ 1 đến 3 tờ"), stake: stakeField });
export const lotoCodeSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/, "Mã phòng gồm 6 ký tự") });
export const lotoClaimSchema = z.object({ roomId: z.uuid(), cardId: z.uuid() });
export const lotoProvinceCreateSchema = z.object({
  title, prize: int(0, 500, "Giải kinh từ 0 đến 500"),
  winRows: int(1, 3, "Số hàng cần đủ để thắng từ 1 đến 3"),
  autoWin: z.boolean(), allowChange: z.boolean(), codeRequired: z.boolean(),
});
export const lotoBoardClaimSchema = z.object({
  roomId: z.uuid(),
  code: z.string().regex(/^VN63-\d{3}$/, "Mã bảng chưa đúng"),
  stake: stakeField,
});
export const grantRequestSchema = z.object({ amount: stakeField });
export const grantDecideSchema = z.object({ requestId: z.uuid(), approve: z.boolean() });
export const lotoInviteSchema = z.object({
  roomId: z.uuid(),
  userIds: z.array(z.uuid()).min(1, "Chọn ít nhất một người để mời").max(50),
});
export const lotoEnterCodeSchema = z.object({
  roomId: z.uuid(),
  code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/, "Mã phòng gồm 6 ký tự"),
});
export const lotoBotsSchema = z.object({
  roomId: z.uuid(),
  count: int(1, 10, "Mỗi lần thêm từ 1 đến 10 bot"),
});

export const bcRoomSchema = z.object({ title });
export const bcRoundSchema = z.object({ roomId: z.uuid(), seconds: int(10, 600, "Thời gian đặt cược từ 10 đến 600 giây") });
export const bcBetSchema = z.object({
  roundId: z.uuid(),
  symbol: int(1, 6, "Ô cược không hợp lệ"),
  amount: int(1, 200, "Mức cược không hợp lệ"),
});

export const idSchema = z.object({ id: z.uuid() });
