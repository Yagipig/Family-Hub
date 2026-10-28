# Family Hub

Website riêng tư cho gia đình / dòng họ: gia phả, sinh nhật, thiệp, chat, album, trò chơi.
Next.js (App Router, TypeScript) + Tailwind + Supabase (PostgreSQL, Auth, Storage, Realtime), triển khai trên Vercel.

Trạng thái: các module MVP và giai đoạn 2–4 đã được viết, build và kiểm thử ở mức CSDL/đơn vị; **chưa chạy với Supabase thật**.
Đọc `docs/STATUS.md` (trạng thái trung thực, vấn đề tồn tại, danh sách phải kiểm tra tay), `docs/DEPLOY.md` (triển khai miễn phí),
`docs/CONVENTIONS.md` (quy ước khi thêm module) và `docs/DOT-1.md` (chi tiết nền tảng Đợt 1).

## Chạy kiểm thử (không cần Docker/Supabase)

```bash
npm install
npm run typecheck
npm test              # vitest (âm lịch, mã hóa, trò chơi, gia phả…)
npm run test:rls      # cần psql + quyền tạo CSDL tạm trên Postgres cục bộ
npm run test:all      # cả ba
```

## Chạy ở máy cá nhân

Cần Docker + Supabase CLI. Chi tiết trong `docs/DOT-1.md`, mục "Chạy local".

## Nguyên tắc bảo mật (đọc trước khi sửa code)

1. Quyền được quyết định ở CSDL (RLS + `has_permission`). Ẩn nút ở giao diện chỉ để đẹp.
2. Mọi bảng riêng tư phải bật RLS ngay trong migration tạo bảng, và phải `revoke all ... from anon, authenticated`
   rồi chỉ `grant` đúng thứ cần (Supabase mặc định cấp quyền cho hai vai trò này trên bảng mới).
3. `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng ở phía máy chủ, không bao giờ đưa vào code trình duyệt hay commit.
4. Không lưu mật khẩu/PIN/OTP ngân hàng. Không giả lập chuyển tiền.
5. Không dùng dữ liệu gia đình thật ở môi trường thử.
