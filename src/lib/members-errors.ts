// Ánh xạ lỗi Postgres/RPC của module Thành viên sang thông báo tiếng Việt (không lộ chi tiết nội bộ).
import { friendlyError } from "./format";

type PgError = { code?: string; message?: string } | null | undefined;

export function memberError(error: PgError): string {
  if (!error) return "";
  const msg = error.message ?? "";
  const code = error.code;
  if (code === "42501") return "Bạn không có quyền thực hiện thao tác này.";
  if (code === "28000") return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (code === "P0001") {
    if (/cycle/i.test(msg)) return "Quan hệ này sẽ tạo vòng lặp trong gia phả (một người không thể là tổ tiên của chính tổ tiên mình).";
    if (/at most two biological parents/i.test(msg)) return "Mỗi người chỉ có tối đa hai cha mẹ ruột. Hãy chọn loại “nuôi” hoặc “kế”, hoặc gỡ một người trước.";
    if (/relationship already exists/i.test(msg)) return "Quan hệ này đã có rồi.";
    if (/parent and child cannot be partners/i.test(msg)) return "Cha mẹ và con không thể là vợ chồng của nhau.";
    if (/linked to an active account/i.test(msg)) return "Hồ sơ này đang gắn với một tài khoản. Hãy gỡ liên kết tài khoản (mục Quản trị → Gắn tài khoản với hồ sơ) trước.";
  }
  if (code === "P0002") return "Không tìm thấy dữ liệu. Có thể đã bị xóa hoặc đã được xử lý trước đó.";
  if (code === "23505") {
    if (/family_memberships_member_unique/.test(msg)) return "Hồ sơ này đã được gắn với một tài khoản khác.";
    return "Dữ liệu này đã tồn tại.";
  }
  if (code === "23514") return "Thông tin chưa hợp lệ (ví dụ ngày tháng không đúng, hoặc nhập ngày mất khi chưa chọn “đã mất”).";
  if (code === "22023") {
    if (/full_name is required/i.test(msg)) return "Vui lòng nhập họ tên.";
    if (/cannot partner with oneself/i.test(msg)) return "Không thể là vợ/chồng của chính mình.";
    if (/members must belong to the family/i.test(msg)) return "Hai hồ sơ phải thuộc cùng một gia đình.";
    if (/branch does not belong/i.test(msg)) return "Nhánh đã chọn không thuộc gia đình này.";
    if (/refers to an unknown member/i.test(msg)) return "Tệp có quan hệ trỏ tới thành viên không có trong tệp.";
    if (/every member needs an id/i.test(msg)) return "Mỗi thành viên trong tệp phải có mã (id).";
    if (/members must be an array/i.test(msg)) return "Tệp không đúng định dạng: thiếu danh sách thành viên.";
    if (/too many members/i.test(msg)) return "Tệp có quá nhiều thành viên (tối đa 2000).";
    if (/bad kind/i.test(msg)) return "Loại quan hệ không hợp lệ.";
  }
  if (code === "22P02" || code === "22003" || code === "22007" || code === "22008")
    return "Thông tin chưa hợp lệ, vui lòng kiểm tra lại các ô đã nhập.";
  return friendlyError(error);
}
