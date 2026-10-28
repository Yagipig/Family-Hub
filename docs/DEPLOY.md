# Hướng dẫn triển khai Family Hub (miễn phí)

Chỉ dùng gói miễn phí: Supabase Free + Vercel Hobby (Hobby chỉ cho dùng **phi thương mại** — đúng với web gia đình) + GitHub Actions.
Chủ dự án tự tạo và giữ các tài khoản GitHub, Vercel, Supabase.

> Trạng thái thật: mã đã build và đã qua kiểm thử SQL/đơn vị, nhưng **chưa từng chạy với một dự án Supabase thật**.
> Hãy làm bước 1–7 trên một dự án THỬ (không có dữ liệu gia đình thật) và đi qua danh sách kiểm tra tay trong `docs/STATUS.md` trước khi nhập dữ liệu thật.

## 1. Supabase
1. Tạo dự án (Settings → region gần người dùng nhất; Việt Nam/Nhật → Singapore hoặc Tokyo). Đặt mật khẩu DB dài, lưu vào trình quản lý mật khẩu.
2. **Authentication → Providers → Email**: TẮT "Allow new users to sign up" (không đăng ký công khai). Đặt độ dài mật khẩu tối thiểu 10. Bật **MFA (TOTP)**.
3. **Authentication → URL Configuration**: Site URL = địa chỉ Vercel của bạn.
4. Chạy các migration **theo thứ tự tên tệp** trong `supabase/migrations/` (SQL Editor hoặc `supabase db push`). Thứ tự: 20261028…01–03 (nền tảng), 20261029…01–03 (thành viên, thông báo), 20261030… (lịch), 20261031… (thiệp/lì xì), 20261101… (chat), 20261102… (ảnh/album/bảng tin), 20261103… (trò chơi).
   - Migration ảnh (20261102…) tạo bucket và chính sách trên `storage.objects`; nếu SQL Editor báo thiếu quyền, chạy bằng vai trò `postgres` qua CLI.
   - Bật **Realtime** cho bảng `messages` và `notifications` (migration tự thêm vào publication `supabase_realtime`; kiểm tra ở Database → Replication).
5. Lấy khóa: Project Settings → API: `URL`, `publishable (anon) key`, `service_role key` (BÍ MẬT).

## 2. Tạo Super Admin đầu tiên (chỉ làm một lần)
Không có đăng ký công khai nên cần tạo tay: Authentication → Users → "Add user" (email của bạn, mật khẩu mạnh, đánh dấu đã xác nhận email).
Sau đó chạy ở SQL Editor (thay email và tên gia đình):
```sql
select public.bootstrap_family('Tên gia đình', (select id from auth.users where email = 'email-cua-ban@example.com'), 'Tên hiển thị của bạn');
```
Hàm chỉ chạy được một lần cho mỗi hệ thống. Đăng nhập, vào **Cài đặt → Bảo mật** đăng ký xác thực hai lớp (bắt buộc để vào khu Quản trị).
Từ đó mời thành viên ở **Quản trị → Lời mời** (mỗi liên kết dùng một lần, có hạn, chỉ lưu dạng băm).

## 3. Vercel
1. Import repo GitHub. Framework: Next.js.
2. Biến môi trường (Production + Preview):
   | Biến | Ghi chú |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | từ bước 1.5 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | từ bước 1.5 (công khai được) |
   | `SUPABASE_SERVICE_ROLE_KEY` | BÍ MẬT, chỉ máy chủ |
   | `NEXT_PUBLIC_SITE_URL` | địa chỉ website |
   | `CRON_SECRET` | ≥ 16 ký tự ngẫu nhiên (`openssl rand -hex 24`) |
   | `PAYOUT_ENC_KEY` | `openssl rand -base64 32`. **Sao lưu riêng**: mất khóa = không giải mã được thông tin nhận tiền đã lưu |
3. `vercel.json` đã khai báo **một** cron hằng ngày `/api/cron/daily` (17:00 UTC ≈ 0h Việt Nam; 2h sáng Nhật). Hobby tối đa 2 cron và chỉ chạy 1 lần/ngày, giờ không chính xác tuyệt đối. Job này làm cả 3 việc: tạo thông báo sinh nhật/giỗ/sự kiện, thông báo thiệp hẹn giờ, dọn ảnh mồ côi.
4. Giới hạn Vercel Hobby: thân yêu cầu tối đa ~4,5 MB (ảnh tải lên đã nén phía trình duyệt, tối đa 4 MB/ảnh; tệp nhập gia phả > 4,5 MB sẽ bị từ chối trước khi vào ứng dụng).

## 4. Sao lưu (BẮT BUỘC — gói miễn phí KHÔNG có sao lưu tự động)
Xem `scripts/backup.sh` và `.github/workflows/backup.yml`: mỗi ngày `pg_dump` (schema public + auth), nén, mã hóa bằng `age`, giữ làm artifact; job này cũng giữ cho dự án khỏi bị tạm dừng sau 1 tuần không hoạt động.
Cần đặt GitHub Secrets: `SUPABASE_DB_URL` (chuỗi kết nối Session pooler), `BACKUP_AGE_PUBLIC_KEY` (khóa công khai age). Giữ **khóa riêng age** ở nơi an toàn, ngoài GitHub.
Thử khôi phục định kỳ: `scripts/restore-verify.sh <tệp>` (khôi phục vào CSDL tạm rồi kiểm tra). **Ảnh trong Storage không nằm trong bản dump** — cần cách sao lưu riêng nếu ảnh quan trọng (tải về định kỳ).

## 5. Kiểm tra trước khi mở cho gia đình
- Chạy `npm run test:all` (kiểu, vitest, và RLS trên Postgres cục bộ).
- Đi qua mục "Kiểm tra tay" của từng module trong `docs/STATUS.md` bằng ít nhất 3 tài khoản: admin, thành viên, khách; thêm một tài khoản bị thu hồi.
- Thử một lần khôi phục từ bản sao lưu.
- Dữ liệu thật chỉ nhập vào dự án production; dự án thử không bao giờ chứa dữ liệu thật.

## 6. Giới hạn gói miễn phí cần biết
Supabase Free: DB 500 MB, Storage 1 GB (50 MB/tệp), Realtime 200 kết nối đồng thời và 2 triệu tin/tháng, **dự án bị tạm dừng sau 1 tuần không hoạt động**, không PITR. Vercel Hobby: phi thương mại, cron 1 lần/ngày.
Email xác thực/quên mật khẩu của Supabase Free bị giới hạn nặng nên hiện CHƯA có chức năng quên mật khẩu trong ứng dụng. Tạm thời: người quản trị đặt lại mật khẩu ở Supabase Dashboard → Authentication → Users rồi báo cho thành viên (xem `docs/STATUS.md`, mục tồn tại).
