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

/**
 * Cau rieng cho tung con so — viet lai 30/10/2026 theo dung dieu ganh hat lo to ma nguoi dung mo ta:
 * moi cau la MOT CAU HAT DAI hai ve co van (hat thanh tieng khoang 8-10 giay), ve sau chua HINH ANH GOI SO
 * (anh Hai -> 2, con khi dot -> 11, nhay mua -> 7...), cuoi cau moi "lo" con so bang doan "... la con so N!".
 */
export const NUMBER_LINES: Record<number, string> = {
  1: "Một mình đứng giữa sân đình, cây nêu cao vút lung linh… là con số 1!",
  2: "Gánh hát về tới đầu làng, anh Hai cất giọng ca vàng… là con số 2!",
  3: "Chị Ba gánh lúa sang ngang, hát câu ví dặm rộn ràng… là con số 3!",
  4: "Anh Tư gánh nước ra đường, vai quang gánh nặng tình thương… là con số 4!",
  5: "Chị Năm têm miếng trầu cau, cánh phượng xếp đẹp đỏ au… là con số 5!",
  6: "Đầu năm xin lộc đầu đình, lộc non xanh biếc rung rinh… là con số 6!",
  7: "Sân đình nhộn nhịp đêm nay, đèn hoa rực rỡ nhảy vui suốt ngày… là con số 7!",
  8: "Tám phương tụ hội về đây, phát tài phát lộc tràn đầy… là con số 8!",
  9: "Trái chín đỏ rực trên cành, chim về ríu rít đầu nhành… là con số 9!",
  10: "Đêm rằm trăng tỏ trên sông, trăng tròn vành vạnh mênh mông… là con số 10!",
  11: "Rừng sâu vang tiếng hú dài, con khỉ đột bước khoan thai… là con số 11!",
  12: "Mười hai bến nước long đong, thuyền nan xuôi ngược trên sông… là con số 12!",
  13: "Mười ba trăng sáng sân nhà, đàn ai réo rắt xa xa… là con số 13!",
  14: "Mười bốn trăng mới nhú mầm, sáng soi đầu ngõ âm thầm… là con số 14!",
  15: "Đêm rằm mười lăm trăng cao, gió đưa hương bưởi ngọt ngào… là con số 15!",
  16: "Trăng mười sáu sáng lung linh, soi nghiêng mặt nước sân đình… là con số 16!",
  17: "Mười bảy bẻ gãy sừng trâu, sức trai phơi phới dẫn đầu… là con số 17!",
  18: "Mười tám anh hào tụ về, rượu đào nâng chén tràn trề… là con số 18!",
  19: "Mười chín đứng giữa lưng đồi, ngắm quê hương đẹp mây trôi ngang trời… là con số 19!",
  20: "Hai mươi tròn chục xinh xinh, tuổi xuân đôi mươi lung linh… là con số 20!",
  21: "Hai mốt mở hội đầu xuân, trống chiêng rộn rã xa gần… là con số 21!",
  22: "Một đôi vịt lội ao làng, nước trong xanh biếc mênh mang… là con số 22!",
  23: "Đôi bạn sánh bước đồng hành, qua đèo qua suối trong xanh… là con số 23!",
  24: "Hai bốn giờ ngọc trong ngày, trân quý từng phút từng giây… là con số 24!",
  25: "Hai lăm đêm sáng trăng vàng, ánh trăng trải khắp đường làng… là con số 25!",
  26: "Hai sáu lộc ghé sang ngang, gõ cửa rộn rã rộn ràng… là con số 26!",
  27: "Hai bảy vững bước đường dài, chân cứng đá mềm không ngại… là con số 27!",
  28: "Hai tám phát lộc hai tay, tay nào cũng nặng lộc đầy… là con số 28!",
  29: "Hai chín chạm tới mây xanh, vươn tay hái lộc trên cành… là con số 29!",
  30: "Ba mươi ngày trọn một vòng, trăng tròn rồi khuyết trên sông… là con số 30!",
  31: "Ba mốt ngày vui trọn tháng, ngày nào cũng sáng như trăng… là con số 31!",
  32: "Ba hai phúc lộc đủ đầy, nhà nhà no ấm sum vầy… là con số 32!",
  33: "Ba ba đội đá vá trời, nữ oa xưa tích truyền đời… là con số 33!",
  34: "Ba bốn bốn phía sum vầy, anh em bốn bể về đây… là con số 34!",
  35: "Ba lăm nắng ấm ban trưa, nắng vàng trải khắp ruộng xưa… là con số 35!",
  36: "Ba sáu cành lá sum suê, chim về làm tổ đề huề… là con số 36!",
  37: "Ba bảy mưa tạnh trời quang, cầu vồng bảy sắc giăng ngang… là con số 37!",
  38: "Ông Địa cười tươi như hoa, lộc về đầy ắp sân nhà… là con số 38!",
  39: "Thần Tài gõ cửa nhà ta, vàng rơi lộc tới la đà… là con số 39!",
  40: "Bốn mươi tuổi đẹp nhất đời, xuân thì phơi phới rạng ngời… là con số 40!",
  41: "Bốn mốt mở lối đi lên, đường lên rực sáng sao đêm… là con số 41!",
  42: "Bốn hai song hỷ lâm môn, vui về đầy ngõ đầy thôn… là con số 42!",
  43: "Bốn ba tam tài vững chắc, đứng như kiềng sắt chẳng lay… là con số 43!",
  44: "Bốn bốn đôi cánh tung bay, vút cao giữa chín tầng mây… là con số 44!",
  45: "Bốn lăm giữa chặng đường hoa, hoa thơm nở khắp quê nhà… là con số 45!",
  46: "Bốn sáu lộc chảy như sông, vào nhà cuồn cuộn mênh mông… là con số 46!",
  47: "Bốn bảy sao sáng dẫn đường, đi xa cũng nhớ quê hương… là con số 47!",
  48: "Bốn tám lộc phát bốn mùa, mùa nào lộc cũng ghé qua… là con số 48!",
  49: "Bốn chín bước cuối lên cao, đỉnh cao vẫy gọi ánh sao… là con số 49!",
  50: "Năm mươi nửa chặng đường dài, hoa niên rực rỡ ban mai… là con số 50!",
  51: "Năm mốt khởi đầu vận mới, gió lành thổi tới nơi nơi… là con số 51!",
  52: "Năm hai tuần lễ trong năm, tuần nào cũng đẹp như rằm… là con số 52!",
  53: "Năm ba tài lộc gõ cửa, mở ra đón lộc ban trưa… là con số 53!",
  54: "Năm bốn bốn phía an hòa, tiếng cười vang khắp quê nhà… là con số 54!",
  55: "Năm lăm đôi bàn tay nắm, nắm tay đi hết tháng năm… là con số 55!",
  56: "Năm sáu chuông gió reo vang, lộc theo tiếng vọng rộn ràng… là con số 56!",
  57: "Năm bảy sao mai rực sáng, báo ngày tốt đẹp huy hoàng… là con số 57!",
  58: "Năm tám phát lộc quanh năm, mùa nào lộc cũng ghé thăm… là con số 58!",
  59: "Năm chín chạm đỉnh vinh quang, vươn tay là tới huy hoàng… là con số 59!",
  60: "Sáu mươi hoa giáp rộn ràng, sáu mươi năm ấy huy hoàng… là con số 60!",
  61: "Sáu mốt lộc lớn về làng, mở màn ván mới rộn ràng… là con số 61!",
  62: "Sáu hai đôi lộc về nhà, lộc đôi sánh bước đường xa… là con số 62!",
  63: "Sáu ba phúc lộc thọ đa, tam đa tề tựu nhà ta… là con số 63!",
  64: "Sáu bốn bốn mùa phát tài, xuân hạ thu đông lộc hoài… là con số 64!",
  65: "Sáu lăm lộc nở đầy vườn, ra vườn hái lộc ngát hương… là con số 65!",
  66: "Sáu sáu lộc chất đầy chồng, lộc cao như núi như sông… là con số 66!",
  67: "Sáu bảy phúc lộc song toàn, đủ đầy đôi ngả bình an… là con số 67!",
  68: "Sáu tám lộc phát tiến lên, bước lên thềm ngọc vững bền… là con số 68!",
  69: "Sáu chín lộc chín vàng ươm, hái về đầy giỏ ngát hương… là con số 69!",
  70: "Bảy mươi thọ tựa núi cao, cổ lai hy ấy tự hào… là con số 70!",
  71: "Bảy mốt mở bước an khang, bước đi vững chãi đường làng… là con số 71!",
  72: "Bảy hai đôi phúc về nhà, phúc đi hai ngả la đà… là con số 72!",
  73: "Bảy ba tam tài thịnh vượng, vượng khí đầy ắp quê hương… là con số 73!",
  74: "Bảy bốn bốn bể anh em, năm châu bốn biển êm đềm… là con số 74!",
  75: "Bảy lăm rực rỡ giữa đường, càng đi càng sáng như gương… là con số 75!",
  76: "Bảy sáu lộc về đầy sân, quét hoài không hết lộc gần… là con số 76!",
  77: "Thất tinh bảy ngôi hội tụ, sáng soi khắp cõi trăng thu… là con số 77!",
  78: "Bảy tám phát lộc phát tài, lộc về như nước chảy hoài… là con số 78!",
  79: "Bảy chín ông Thần Tài lớn, lộc to gõ cửa rộn ràng đầu sân… là con số 79!",
  80: "Tám mươi thượng thọ an khang, cháu con sum họp rộn ràng… là con số 80!",
  81: "Tám mốt đại phát từ đầu, vận may theo suốt dài lâu… là con số 81!",
  82: "Tám hai phát mãi không ngừng, như suối trong mát lưng chừng… là con số 82!",
  83: "Tám ba phát tài tam đa, lộc về như hội tháng ba… là con số 83!",
  84: "Tám bốn phát bốn mùa hoa, hoa nở quanh khắp quê nhà… là con số 84!",
  85: "Tám lăm phát lộc đầy nhà, lộc nhiều như cát sông xa… là con số 85!",
  86: "Tám sáu phát lộc dồi dào, lộc về như sóng dâng trào… là con số 86!",
  87: "Tám bảy cành lá sum suê, lộc che bóng mát tràn trề… là con số 87!",
  88: "Tám tám phát mãi không thôi, phát như sóng biển trùng khơi… là con số 88!",
  89: "Tám chín lộc bền dài lâu, cửu cửu trường tồn về sau… là con số 89!",
  90: "Chín mươi số cuối của bảng, khép vòng cho trọn huy hoàng… là con số 90!",
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
