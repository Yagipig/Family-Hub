/**
 * Thư viện mẫu thiệp. Hình minh họa là SVG/CSS tự vẽ (xem src/components/CardArt.tsx), không dùng hình bản quyền
 * hay nhân vật có bản quyền. Dữ liệu ở đây ĐỒNG BỘ với bảng card_templates trong migration 20261031000001
 * (test card-templates.test.ts đối chiếu từng khóa, tên, dịp, hiệu ứng, họa tiết, bảng màu và thứ tự).
 */

export const OCCASIONS = {
  tet: "Tết",
  "sinh-nhat": "Sinh nhật",
  gio: "Giỗ / tưởng nhớ",
  cuoi: "Đám cưới",
  "ta-on": "Tạ ơn",
  "trung-thu": "Trung thu",
  "chuc-mung": "Chúc mừng",
} as const;
export type Occasion = keyof typeof OCCASIONS;

/** Tiêu đề mặc định hiển thị trên thiệp khi người gửi không đặt tiêu đề. */
export const DEFAULT_TITLES: Record<Occasion, string> = {
  tet: "Chúc mừng năm mới",
  "sinh-nhat": "Chúc mừng sinh nhật",
  gio: "Tưởng nhớ",
  cuoi: "Chúc mừng hạnh phúc",
  "ta-on": "Lời tri ân",
  "trung-thu": "Vui Trung thu",
  "chuc-mung": "Chúc mừng",
};

export type Effect = "envelope" | "petals" | "confetti" | "lantern";
export const EFFECT_LABELS: Record<Effect, string> = {
  envelope: "Mở phong bì",
  petals: "Rắc cánh hoa",
  confetti: "Pháo giấy",
  lantern: "Đèn lồng bay",
};

export type Motif =
  | "mai" | "redenvelope" | "lantern" | "balloons" | "cake" | "candle"
  | "rose" | "rings" | "lotus" | "starlantern" | "burst";

export type Palette = { bg: string; bg2: string; text: string; accent: string; particle: string };

export type CardTemplate = {
  key: string;
  name: string;
  occasion: Occasion;
  effect: Effect;
  motif: Motif;
  palette: Palette;
  sortOrder: number;
};

export const CARD_TEMPLATES: readonly CardTemplate[] = [
  { key: "tet-hoa-mai", name: "Hoa mai đầu xuân", occasion: "tet", effect: "petals", motif: "mai", sortOrder: 10,
    palette: { bg: "#7b1e2b", bg2: "#5c1520", text: "#fff6e0", accent: "#f2c14e", particle: "#f6d365" } },
  { key: "tet-phong-bao", name: "Phong bao đỏ", occasion: "tet", effect: "envelope", motif: "redenvelope", sortOrder: 20,
    palette: { bg: "#a4161a", bg2: "#7b1e2b", text: "#fff6e0", accent: "#e7c27d", particle: "#e7c27d" } },
  { key: "tet-den-long", name: "Đèn lồng xuân", occasion: "tet", effect: "lantern", motif: "lantern", sortOrder: 30,
    palette: { bg: "#5c1520", bg2: "#2a1a1a", text: "#fbf0d9", accent: "#c9a96b", particle: "#e8b04a" } },
  { key: "sinh-nhat-bong-bay", name: "Bóng bay sinh nhật", occasion: "sinh-nhat", effect: "confetti", motif: "balloons", sortOrder: 40,
    palette: { bg: "#fff3d6", bg2: "#f1e6cc", text: "#5c1520", accent: "#7b1e2b", particle: "#c9a96b" } },
  { key: "sinh-nhat-banh-kem", name: "Bánh kem ấm áp", occasion: "sinh-nhat", effect: "envelope", motif: "cake", sortOrder: 50,
    palette: { bg: "#fbf6ec", bg2: "#f1e6cc", text: "#5c1520", accent: "#7b1e2b", particle: "#c9a96b" } },
  { key: "gio-nen-tam-huong", name: "Nén tâm hương", occasion: "gio", effect: "lantern", motif: "candle", sortOrder: 60,
    palette: { bg: "#3a2a2a", bg2: "#2a1a1a", text: "#f1e6cc", accent: "#c9a96b", particle: "#f4d58d" } },
  { key: "cuoi-hoa-hong", name: "Hoa hồng đỏ rượu", occasion: "cuoi", effect: "petals", motif: "rose", sortOrder: 70,
    palette: { bg: "#fffdf8", bg2: "#f1e6cc", text: "#5c1520", accent: "#7b1e2b", particle: "#a4313f" } },
  { key: "cuoi-nhan-doi", name: "Nhẫn đôi trăm năm", occasion: "cuoi", effect: "confetti", motif: "rings", sortOrder: 80,
    palette: { bg: "#fbf6ec", bg2: "#ead9b0", text: "#5c1520", accent: "#b08d4a", particle: "#c9a96b" } },
  { key: "ta-on-hoa-sen", name: "Tạ ơn hoa sen", occasion: "ta-on", effect: "petals", motif: "lotus", sortOrder: 90,
    palette: { bg: "#fbf6ec", bg2: "#ecdcbc", text: "#5c1520", accent: "#7b1e2b", particle: "#d9a5a5" } },
  { key: "trung-thu-den-sao", name: "Rằm trung thu", occasion: "trung-thu", effect: "lantern", motif: "starlantern", sortOrder: 100,
    palette: { bg: "#2a1a1a", bg2: "#5c1520", text: "#fbf0d9", accent: "#e8b04a", particle: "#f4d58d" } },
  { key: "chuc-mung-rang-ro", name: "Chúc mừng rạng rỡ", occasion: "chuc-mung", effect: "confetti", motif: "burst", sortOrder: 110,
    palette: { bg: "#7b1e2b", bg2: "#a4313f", text: "#fff6e0", accent: "#f1e6cc", particle: "#e7c27d" } },
];

export const DEFAULT_TEMPLATE_KEY = "tet-hoa-mai";

export function getTemplate(key: string | null | undefined): CardTemplate {
  return CARD_TEMPLATES.find((t) => t.key === key) ?? CARD_TEMPLATES[0];
}

export function isTemplateKey(key: string): boolean {
  return CARD_TEMPLATES.some((t) => t.key === key);
}

/** Lời chúc gợi ý theo dịp để người lớn tuổi không phải nghĩ từ đầu (tự viết, không sao chép nguồn nào). */
export const SUGGESTED_MESSAGES: Record<Occasion, string> = {
  tet: "Chúc ông bà, cha mẹ và cả nhà một năm mới an khang, thịnh vượng, sức khỏe dồi dào và mọi điều như ý.",
  "sinh-nhat": "Chúc mừng sinh nhật! Chúc bạn luôn mạnh khỏe, bình an và thật nhiều niềm vui bên gia đình.",
  gio: "Nhân ngày giỗ, con cháu thắp nén tâm hương tưởng nhớ. Xin người phù hộ cho cả nhà bình an, đoàn kết.",
  cuoi: "Chúc hai bạn trăm năm hạnh phúc, đầu bạc răng long, luôn yêu thương và sẻ chia cùng nhau.",
  "ta-on": "Xin chân thành cảm ơn tấm lòng của mọi người. Chúc cả nhà luôn bình an và ấm áp.",
  "trung-thu": "Trung thu đoàn viên! Chúc các cháu vui rằm thật lớn và cả nhà quây quần, hạnh phúc.",
  "chuc-mung": "Chúc mừng bạn! Cả nhà vui và tự hào về những điều bạn đã làm được.",
};
