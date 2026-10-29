// Doi thong diep loi cua ham SQL (module tro choi) sang tieng Viet than thien. Khong lo chi tiet noi bo.
// Tra ve null neu khong phai loi cua module nay (khi do dung friendlyError chung).

const MESSAGES: Array<[RegExp, string]> = [
  [/games_disabled/, "Trò chơi đang được tắt. Quản trị sẽ bật lại khi có dịp vui."],
  [/already_claimed/, "Hôm nay bạn đã nhận quà rồi. Hẹn bạn ngày mai!"],
  [/no_gift/, "Quà hằng ngày hiện đang tắt."],
  [/insufficient_points/, "Số dư của bạn không đủ cho thao tác này."],
  [/already_drawn/, "Bạn đã bốc bao lì xì này rồi."],
  [/\bempty\b/, "Bao lì xì đã được bốc hết."],
  [/max_tickets/, "Bạn đã nhận đủ số vé cho kỳ này."],
  [/too_early/, "Chưa đến giờ, vui lòng chờ thêm một chút."],
  [/not_open/, "Kỳ quay này đã kết thúc."],
  [/commit mismatch/, "Không thể quay số vì mã cam kết không khớp. Vui lòng báo quản trị."],
  [/already_joined/, "Bạn đã vào phòng này rồi."],
  [/not_waiting/, "Ván đã bắt đầu, không vào thêm được."],
  [/not_playing/, "Ván chưa bắt đầu hoặc đã kết thúc."],
  [/no_players/, "Chưa có người chơi nào trong phòng."],
  [/all_called/, "Đã hô đủ 90 số."],
  [/already_finished/, "Ván này đã kết thúc."],
  [/too_many_false_claims/, "Bạn đã kinh nhầm 3 lần trong ván này nên tạm nghỉ ván này."],
  [/betting_closed/, "Đã hết giờ đặt cược của ván này."],
  [/bet_out_of_range/, "Mức cược chưa nằm trong khoảng cho phép."],
  [/over_max_bet/, "Ô này đã đạt mức cược tối đa."],
  [/over_round_total/, "Tổng mức cược của ván này đã đạt mức tối đa."],
  [/over_daily_budget/, "Cược này vượt hạn mức thua trong ngày. Hãy chọn mức nhỏ hơn."],
  [/daily_limit_loss/, "Hôm nay bạn đã chơi đủ rồi. Hẹn bạn ngày mai!"],
  [/daily_limit_win/, "Hôm nay bạn đã thắng khá nhiều rồi. Hẹn bạn ngày mai!"],
  [/round_open/, "Ván hiện tại chưa hết giờ đặt cược."],
  [/room_closed/, "Phòng đã đóng."],
  [/not_betting/, "Ván này đã được chốt."],
  [/^closed$|\bclosed\b/, "Đã hết thời gian hoặc đã đóng."],
  [/bc_one_open_room|bc_one_betting_round/, "Đang có một phòng/ván mở rồi."],
  [/board_taken/, "Bảng này vừa có người chọn mất rồi. Bạn chọn bảng tỉnh khác nhé!"],
  [/change_not_allowed/, "Chủ phòng không cho đổi bảng trong phòng này."],
  [/no_other_player/, "Chưa có người chơi nào khác để chuyển quyền chủ phòng."],
  [/already_host/, "Người này đang là chủ phòng rồi."],
  [/nothing_to_undo/, "Chưa có số nào để hoàn tác."],
  [/not_paused/, "Ván không ở trạng thái tạm dừng."],
  [/wrong_mode/, "Phòng này không phải phòng lô tô truyền thống."],
  [/not_member/, "Người được chuyển không còn là thành viên gia đình."],
];

export function gamesError(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error) return null;
  const msg = error.message ?? "";
  for (const [re, text] of MESSAGES) if (re.test(msg)) return text;
  if (error.code === "P0002") return "Không tìm thấy mục này.";
  return null;
}
