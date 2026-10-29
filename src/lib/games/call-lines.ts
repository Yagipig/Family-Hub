// Thu vien cau ho lo to vui nhon (phong cach ganh lo to truyen thong, cau chu tu soan).
// Moi cau deu noi ro con so o cuoi de nguoi choi do theo. Admin co the them cau rieng (extraLines)
// qua cai dat tro choi; cac cau them duoc tron vao nhom cau chung.

export const OPENING_LINES = [
  "Bà con cô bác ổn định chỗ ngồi, chuẩn bị hạt bắp hạt đậu, ván lô tô bắt đầu đây!",
  "Kính mời bà con lắng tai nghe cho rõ, tay cầm bút, mắt nhìn bảng, lô tô khởi hành!",
  "Ván mới bắt đầu, chúc bà con may mắn, ai cũng có cơ hội kinh to!",
  "Đèn đã sáng, bi đã lăn, bà con sẵn sàng chưa nào!",
];

export const CLOSING_LINES = [
  "Ván này khép lại, cảm ơn bà con đã chơi cùng. Hẹn ván sau còn vui hơn!",
  "Hết ván! Ai chưa kinh đừng buồn, may mắn đang gõ cửa ván tới.",
  "Xin chúc mừng người thắng, bà con vỗ tay thật to nào!",
];

export const TEASING_LINES = [
  "Ai đang chờ một số duy nhất thì giơ tay nào… hồi hộp chưa!",
  "Có người mồ hôi tay rồi kìa, chờ con số định mệnh thôi!",
  "Bà con ngồi yên, đừng nôn nóng, số đẹp thường ra sau cùng!",
  "Nghe nói có bảng chỉ còn thiếu đúng một số, thật không nào?",
  "Càng về cuối càng gay cấn, bà con giữ chặt bảng của mình nhé!",
  "Ai chưa có số nào thì đừng lo, bi còn nhiều, cơ hội còn nguyên!",
];

export const NEAR_WIN_LINES = [
  "Ối chà, có người chỉ còn thiếu MỘT số nữa là kinh! Căng thẳng quá!",
  "Sắp kinh rồi kìa! Chỉ một số nữa thôi, bà con nín thở nào!",
  "Một số nữa thôi là nổ kinh! Ai đang chờ thì cầu may đi nhé!",
];

export const KINH_LINES = [
  "KINH RỒI NHÉ! Xin chúc mừng, cả nhà vỗ tay thật to nào!",
  "Nổ kinh rồi! Tuyệt vời, chúc mừng người thắng của ván này!",
  "Đã có người kinh! Tiếng pháo tay đâu rồi bà con ơi!",
];

/** Cau rieng cho tung con so (noi ro so o cuoi cau). */
export const NUMBER_LINES: Record<number, string> = {
  1: "Số một đứng đầu bảng vàng, mở hàng may mắn… con số 1!",
  2: "Một đôi sóng bước song hành, là con số 2!",
  3: "Tam tài tam lộc đầy nhà, con số 3!",
  4: "Tứ phương tám hướng đều thông, con số 4!",
  5: "Ngũ hành rực rỡ sắc màu, con số 5!",
  6: "Lộc về lộc tới lộc đầy tay, con số 6!",
  7: "Thất tinh sáng tỏ trên trời, con số 7!",
  8: "Phát tài phát lộc quanh năm, con số 8!",
  9: "Cửu trùng cao vút mây xanh, con số 9!",
  10: "Tròn trịa như trăng đêm rằm, con số 10!",
  11: "Hai que củi đứng thẳng hàng, con số 11!",
  12: "Một năm mười hai tháng đều may, con số 12!",
  15: "Trăng tròn mười lăm sáng ngời, con số 15!",
  18: "Mười tám anh hào tụ hội, con số 18!",
  20: "Hai mươi tròn chục đẹp thay, con số 20!",
  22: "Một đôi vịt lội ao làng, con số 22!",
  25: "Hai lăm, đêm trăng sáng tỏ, con số 25!",
  30: "Ba mươi, khép lại một vòng, con số 30!",
  33: "Ba ba đội đá vá trời, con số 33!",
  36: "Ba sáu, lộc lá sum suê, con số 36!",
  38: "Ông Địa cười tươi đón lộc, con số 38!",
  39: "Ông Thần Tài gõ cửa nhà ta, con số 39!",
  40: "Bốn mươi, tuổi xuân phơi phới, con số 40!",
  44: "Bốn bốn, đôi cánh tung bay, con số 44!",
  50: "Năm mươi, nửa chặng đường rồi, con số 50!",
  55: "Năm lăm, đôi bàn tay nắm, con số 55!",
  60: "Sáu mươi, một vòng hoa giáp, con số 60!",
  66: "Sáu sáu, lộc chồng thêm lộc, con số 66!",
  68: "Sáu tám, lộc phát tiến lên, con số 68!",
  77: "Bảy bảy, thất tinh hội tụ, con số 77!",
  80: "Tám mươi, thượng thọ an khang, con số 80!",
  86: "Tám sáu, phát lộc dồi dào, con số 86!",
  88: "Tám tám, phát hoài không nghỉ, con số 88!",
  90: "Chín mươi, con số cuối cùng của bảng, con số 90!",
};

/** Cau chung cho moi con so ({n} = con so). */
export const GENERIC_LINES = [
  "Cờ ra con mấy, con mấy gì đây… con số {n}!",
  "Bi lăn bi lăn, dừng lại ở… con số {n}!",
  "Nghe cho rõ, nhìn cho kỹ… con số {n}!",
  "Con số tiếp theo xin được gọi tên… số {n}!",
  "Ai chờ số này thì reo lên nào… con số {n}!",
  "Trống đánh vang vang, bi ra… con số {n}!",
  "Số gì đây, số gì đây… con số {n}!",
  "Mời bà con dò bảng… con số {n}!",
];

export type CallLineOptions = {
  /** 0..100: tan suat dung cau vui thay vi "So n" kho khan. */
  chatter: number;
  /** Cau rieng do admin them (tron vao nhom cau chung). */
  extraLines?: string[];
  /** Ham ngau nhien [0,1) de test duoc. */
  rand?: () => number;
};

const pick = <T,>(arr: readonly T[], rand: () => number): T => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];

/** Cau ho cho mot con so: co the la cau rieng, cau chung, hoac "So n" gon gang tuy tan suat chatter. */
export function callLineFor(n: number, opts: CallLineOptions): string {
  const rand = opts.rand ?? Math.random;
  const roll = rand() * 100;
  if (roll >= opts.chatter) return `Số ${n}`;
  const special = NUMBER_LINES[n];
  if (special && rand() < 0.75) return special;
  const pool = [...GENERIC_LINES, ...(opts.extraLines ?? []).filter((s) => s.trim().length > 0)];
  return pick(pool, rand).replaceAll("{n}", String(n));
}

export function randomLine(group: "opening" | "closing" | "teasing" | "nearWin" | "kinh", rand: () => number = Math.random): string {
  switch (group) {
    case "opening": return pick(OPENING_LINES, rand);
    case "closing": return pick(CLOSING_LINES, rand);
    case "teasing": return pick(TEASING_LINES, rand);
    case "nearWin": return pick(NEAR_WIN_LINES, rand);
    case "kinh": return pick(KINH_LINES, rand);
  }
}
