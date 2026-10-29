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
  13: "Mười ba, trăng sáng sân nhà, ai chờ thì reo lên… con số 13!",
  14: "Mười bốn, trăng nhú đầu non, sáng dần lên nhé… con số 14!",
  15: "Trăng tròn mười lăm sáng ngời, con số 15!",
  16: "Mười sáu, trăng sáng nhất trời, đêm nay sáng tỏ… con số 16!",
  17: "Mười bảy bẻ gãy sừng trâu, sức xuân phơi phới… con số 17!",
  18: "Mười tám anh hào tụ hội, con số 18!",
  19: "Mười chín, bước tới đỉnh đồi, nhìn xa trông rộng… con số 19!",
  20: "Hai mươi tròn chục đẹp thay, con số 20!",
  21: "Hai mốt, mở hội đầu xuân, tưng bừng náo nhiệt… con số 21!",
  22: "Một đôi vịt lội ao làng, con số 22!",
  23: "Hai ba, đôi bạn đồng hành, đi đâu cũng có nhau… con số 23!",
  24: "Hai bốn, giờ vàng trọn ngày, giờ nào cũng quý… con số 24!",
  25: "Hai lăm, đêm trăng sáng tỏ, con số 25!",
  26: "Hai sáu, lộc về đầu ngõ, sắp vào tới nhà rồi… con số 26!",
  27: "Hai bảy, vững bước đường dài, chân cứng đá mềm… con số 27!",
  28: "Hai tám, phát lộc hai tay, tay nào cũng đầy… con số 28!",
  29: "Hai chín, chạm tới mây xanh, cao thêm chút nữa… con số 29!",
  30: "Ba mươi, khép lại một vòng, con số 30!",
  31: "Ba mốt, ngày vui trọn tháng, tháng nào cũng trọn… con số 31!",
  32: "Ba hai, phúc lộc đủ đầy, nhà nào cũng ấm no… con số 32!",
  33: "Ba ba đội đá vá trời, con số 33!",
  34: "Ba bốn, bốn phương sum vầy, anh em tụ họp… con số 34!",
  35: "Ba lăm, nắng ấm ban trưa, rực rỡ nhất ngày… con số 35!",
  36: "Ba sáu, lộc lá sum suê, con số 36!",
  37: "Ba bảy, mưa tạnh trời quang, cầu vồng sắp hiện… con số 37!",
  38: "Ông Địa cười tươi đón lộc, con số 38!",
  39: "Ông Thần Tài gõ cửa nhà ta, con số 39!",
  40: "Bốn mươi, tuổi xuân phơi phới, con số 40!",
  41: "Bốn mốt, mở lối đi lên, đường quang đãng nhé… con số 41!",
  42: "Bốn hai, song hỷ lâm môn, vui nhân đôi nhé… con số 42!",
  43: "Bốn ba, tam tài vững chắc, đứng vững như kiềng… con số 43!",
  44: "Bốn bốn, đôi cánh tung bay, con số 44!",
  45: "Bốn lăm, giữa chặng đường hoa, hoa nở hai bên… con số 45!",
  46: "Bốn sáu, lộc vào như nước, cản không kịp nữa… con số 46!",
  47: "Bốn bảy, sao sáng dẫn đường, đi đâu cũng tới… con số 47!",
  48: "Bốn tám, phát đều bốn mùa, mùa nào cũng phát… con số 48!",
  49: "Bốn chín, bước cuối lên cao, sắp tới đỉnh rồi… con số 49!",
  50: "Năm mươi, nửa chặng đường rồi, con số 50!",
  51: "Năm mốt, khởi đầu vận mới, gió đổi chiều may… con số 51!",
  52: "Năm hai, tuần nào cũng vui, trọn năm rộn ràng… con số 52!",
  53: "Năm ba, tài lộc gõ cửa, nghe tiếng gõ chưa… con số 53!",
  54: "Năm bốn, bốn phương an hòa, nhà nhà êm ấm… con số 54!",
  55: "Năm lăm, đôi bàn tay nắm, con số 55!",
  56: "Năm sáu, lộc reo rộn ràng, như chuông gió reo… con số 56!",
  57: "Năm bảy, sao mai rực sáng, báo ngày tốt lành… con số 57!",
  58: "Năm tám, phát lộc quanh năm, quanh năm không nghỉ… con số 58!",
  59: "Năm chín, chạm đỉnh vinh quang, vươn tay là tới… con số 59!",
  60: "Sáu mươi, một vòng hoa giáp, con số 60!",
  61: "Sáu mốt, mở màn lộc lớn, ván này lộc to… con số 61!",
  62: "Sáu hai, đôi lộc về nhà, lộc đi thành cặp… con số 62!",
  63: "Sáu ba, tài lộc tam đa, phúc lộc thọ đủ… con số 63!",
  64: "Sáu bốn, bốn mùa phát tài, xuân hạ thu đông… con số 64!",
  65: "Sáu lăm, lộc nở đầy vườn, ra vườn mà hái… con số 65!",
  66: "Sáu sáu, lộc chồng thêm lộc, con số 66!",
  67: "Sáu bảy, phúc lộc song toàn, đủ cả đôi đường… con số 67!",
  68: "Sáu tám, lộc phát tiến lên, con số 68!",
  69: "Sáu chín, lộc chín vàng ươm, hái là trúng lớn… con số 69!",
  70: "Bảy mươi, cổ lai hy thọ, thọ như núi cao… con số 70!",
  71: "Bảy mốt, mở bước an khang, bước nào cũng chắc… con số 71!",
  72: "Bảy hai, đôi phúc song toàn, phúc về hai ngả… con số 72!",
  73: "Bảy ba, tam tài thịnh vượng, vượng khí đầy nhà… con số 73!",
  74: "Bảy bốn, bốn bể anh em, đâu cũng là nhà… con số 74!",
  75: "Bảy lăm, rực rỡ giữa đường, càng đi càng sáng… con số 75!",
  76: "Bảy sáu, lộc về đầy sân, quét không hết lộc… con số 76!",
  77: "Bảy bảy, thất tinh hội tụ, con số 77!",
  78: "Bảy tám, phát tài phát lộc, phát hoài phát mãi… con số 78!",
  79: "Bảy chín, ông Thần Tài lớn, lộc lớn gõ cửa… con số 79!",
  80: "Tám mươi, thượng thọ an khang, con số 80!",
  81: "Tám mốt, khởi đầu đại phát, phát ngay từ đầu… con số 81!",
  82: "Tám hai, phát mãi không ngừng, như suối chảy hoài… con số 82!",
  83: "Tám ba, phát tài tam đa, đa phúc đa lộc… con số 83!",
  84: "Tám bốn, phát bốn mùa hoa, hoa nở quanh năm… con số 84!",
  85: "Tám lăm, phát lộc đầy nhà, đầy như kho báu… con số 85!",
  86: "Tám sáu, phát lộc dồi dào, con số 86!",
  87: "Tám bảy, phát lộc sum suê, cành lá xum xuê… con số 87!",
  88: "Tám tám, phát hoài không nghỉ, con số 88!",
  89: "Tám chín, phát trường cửu cửu, lộc bền lâu dài… con số 89!",
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
