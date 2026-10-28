# Đợt 1 — Nền tảng, đăng nhập, lời mời, phân quyền

Ngày: 28/10/2026

## 1. Chức năng đã hoàn thành

| Chức năng | Trạng thái | Cách đã kiểm chứng |
| --- | --- | --- |
| Bảng tổ chức, danh tính, vai trò, quyền, lời mời, nhật ký (migration) | Xong | Chạy được từ đầu trên Postgres 16 |
| Hàm quyền duy nhất `has_permission`, RLS mặc định từ chối | Xong | 90 kiểm tra tự động đạt (`npm run test:rls`) |
| Lời mời có thời hạn, token chỉ lưu dạng băm, dùng một lần | Xong (DB) | Kiểm tra tự động: sai email, dùng lại, hết hạn (thu hồi lời mời: kiểm tra tay, mục 4) |
| Chỉ Super Admin mời/đổi vai trò admin; không mất Super Admin cuối | Xong | Kiểm tra tự động |
| Thu hồi quyền có hiệu lực ngay | Xong | Kiểm tra tự động (mất quyền xem ngay lập tức) |
| Khóa/mở khóa chỉnh sửa theo gia đình và nhánh, có hẹn giờ tự đóng | Xong (DB + trang admin) | Kiểm tra tự động; chưa dùng cho dữ liệu vì chưa có hồ sơ (Đợt 2) |
| Nhật ký chỉ-thêm (không sửa/xóa được kể cả superuser) | Xong | Kiểm tra tự động |
| Sao lưu mã hóa + kiểm tra khôi phục | Xong (script) | Sao lưu → mã hóa → khôi phục vào CSDL tạm, đếm dòng khớp |
| Web: đăng nhập, nhận lời mời, thiết lập MFA, trang quản trị (lời mời, tài khoản, gia đình/nhánh/chế độ chỉnh sửa) | Viết xong, **chưa chạy với Supabase thật** | `tsc` và `next build` đạt; người chưa đăng nhập bị chuyển về /dang-nhap ở mọi trang riêng tư |

Chưa làm trong Đợt 1 (theo kế hoạch): hồ sơ thành viên, gia phả, sinh nhật, thiệp, chat. Trang chủ hiện chỉ là lời chào.

## 2. Tệp chính

- `supabase/migrations/` — ba migration: bảng, ma trận quyền mặc định, hàm + RLS + cấp quyền.
- `supabase/tests/` — bộ kiểm thử RLS (`rls_tests.sql`), phần giả lập Supabase (`00_stub_supabase.sql`), script chạy.
- `src/proxy.ts` — chặn thô người chưa đăng nhập (Next 16 gọi là "proxy", tên cũ là middleware).
- `src/lib/auth.ts` — lớp kiểm tra phiên/quyền dùng ở mọi trang và Server Action.
- `src/app/(auth)/` — đăng nhập, nhận lời mời, nhập mã MFA, trang "không có quyền".
- `src/app/(app)/` — khung giao diện, trang chủ, cài đặt, thiết lập MFA, khu quản trị `admin/`.
- `scripts/backup.sh`, `scripts/restore-verify.sh`, `.github/workflows/` — sao lưu hằng ngày và CI.

## 3. Cài đặt production (gói miễn phí)

Bạn tự tạo và giữ các tài khoản; mã nguồn để ở kho GitHub **riêng tư**.

1. **GitHub**: tạo kho private, đẩy mã nguồn lên.
2. **Supabase**: tạo một dự án (chọn vùng gần nhất). Trong Authentication:
   - Tắt "Allow new users to sign up".
   - Bật MFA TOTP, đặt độ dài mật khẩu tối thiểu 10.
   - Site URL = địa chỉ website Vercel của bạn.
3. **Áp migration**: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
4. **Tạo Super Admin đầu tiên**:
   - Authentication → Users → Add user (nhập email, mật khẩu, tick Auto Confirm). Sao chép `UID` của người dùng.
   - SQL Editor, chạy: `select public.bootstrap_family('Tên gia đình', '<UID>', 'Tên hiển thị của bạn');`
   - Hàm này chỉ chạy được một lần.
5. **Vercel**: import kho GitHub, khai báo biến môi trường (xem `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
   Khóa service-role chỉ khai báo trên Vercel, không để trong mã nguồn.
6. **Lần đăng nhập đầu**: đăng nhập, vào Cài đặt → Thiết lập xác thực hai lớp, rồi vào Quản trị.
7. **Sao lưu** (gói miễn phí không có sao lưu tự động):
   - Trên máy bạn: `age-keygen -o khoa-rieng.txt`. Cất file này ở nơi an toàn (trình quản lý mật khẩu), **mất file này là không giải mã được bản sao lưu**.
   - GitHub → Settings → Secrets: `BACKUP_AGE_PUBLIC_KEY` (dòng `age1...` hiển thị khi tạo khóa) và `SUPABASE_DB_URL`
     (chuỗi kết nối Postgres lấy ở Supabase → Connect; GitHub chạy trên IPv4 nên nên dùng chuỗi "Session pooler"; kiểm tra lại tên mục trên giao diện hiện tại).
   - Chạy thử workflow "Sao luu CSDL hang ngay" bằng tay (Actions → Run workflow); từ đó tự chạy hằng ngày và cũng giữ cho dự án không bị tạm dừng vì ít truy cập.
   - Mỗi tháng: tải một bản về máy và chạy `AGE_KEY_FILE=khoa-rieng.txt ./scripts/restore-verify.sh <file>` để xác nhận khôi phục được.
   - Nếu phiên bản Postgres của Supabase khác 17, đổi số phiên bản trong `.github/workflows/backup.yml`.

### Chạy local

```bash
npm install
npx supabase start          # cần Docker; in ra URL và khóa
cp .env.example .env.local  # điền URL, publishable key, service role key do lệnh trên in ra
npx supabase db reset       # áp migration
npm run dev
```

## 4. Cách kiểm tra (làm trên môi trường của bạn)

Các mục dưới đây chỉ chạy được với Supabase thật nên chưa được kiểm chứng ở đây. Hãy thử và báo lại kết quả.

1. Mở website khi chưa đăng nhập: mọi trang đều chuyển về đăng nhập (tiêu chí MVP số 1).
2. Đăng nhập bằng Super Admin → vào Quản trị: được yêu cầu bật MFA, bật xong mới vào được.
3. Tạo lời mời "Thành viên" → mở liên kết trong cửa sổ ẩn danh → tạo tài khoản → vào được trang chủ, **không** thấy mục Quản trị.
4. Mở lại liên kết đã dùng: báo không dùng được. Tạo lời mời khác rồi thu hồi: liên kết báo không dùng được.
5. Thu hồi quyền tài khoản vừa tạo: tải lại trang ở cửa sổ ẩn danh, bị đưa về trang "không có quyền".
6. Với tài khoản Thành viên, gõ thẳng `/admin`: bị đưa về trang chủ.
7. Tạo nhánh, mời một người làm "Quản trị nhánh": họ chỉ mời được thành viên vào nhánh của mình, và chỉ khóa/mở chỉnh sửa nhánh của mình.
8. Super Admin thử tự thu hồi quyền hoặc hạ vai trò khi là Super Admin duy nhất: bị chặn.

## 5. Vấn đề còn tồn tại / cần quyết định

1. **Xác thực email chưa bắt buộc**. Tài khoản tạo từ lời mời được đánh dấu đã xác nhận, vì liên kết mời do admin gửi riêng và gói miễn phí giới hạn việc gửi email.
   Cần chốt câu hỏi số 3 (email) ở tài liệu kiến trúc để bổ sung xác thực hộp thư và quên mật khẩu.
2. **Quên mật khẩu chưa có** (cần gửi email). Hiện admin phải đặt lại mật khẩu trong Supabase Dashboard.
3. **Giới hạn tần suất**: đăng nhập dựa vào giới hạn của Supabase Auth; trang nhận lời mời chỉ dựa vào token ngẫu nhiên 192 bit. Chưa có giới hạn riêng cho gửi thiệp, xem thông tin ngân hàng, chat (các tính năng đó chưa tồn tại).
4. **Thu hồi quyền**: dữ liệu bị chặn ngay bởi RLS và các trang kiểm tra lại mỗi lần tải, nhưng mã đăng nhập (JWT) cũ vẫn còn hiệu lực đến khi hết hạn. Có thể bổ sung khóa hẳn tài khoản trong Supabase Auth.
5. **Bộ kiểm thử RLS chạy trên Postgres thường** với phần giả lập Supabase (`auth.uid()` đọc từ biến phiên). Nó chưa chạy trên Supabase thật. Nên bổ sung kiểm thử chạy trên Supabase local khi có Docker.
6. **Thêm/sửa nhánh họ** là ghi trực tiếp (qua RLS), chưa vào nhật ký. Sẽ chuyển sang hàm có ghi nhật ký khi làm gia phả.
7. **Quy tắc cho migration sau này**: bảng mới trong `public` mặc định được Supabase cấp quyền cho `anon`/`authenticated`; mỗi migration phải `revoke` rồi `grant` đúng như migration 3.
8. **Giao diện**: dùng component Tailwind tự viết (chưa dùng shadcn/ui). Chưa có logo/ảnh bìa (chờ kho lưu trữ ảnh ở Đợt 2). Chưa kiểm tra trên thiết bị thật và chưa chạy kiểm tra khả năng tiếp cận bằng công cụ.
9. **Lưu ý gói miễn phí**: CSDL 500 MB, kho file 1 GB, dự án tạm dừng nếu 1 tuần không hoạt động (job sao lưu hằng ngày giữ dự án hoạt động).

## 6. Bước tiếp theo

Đợt 2 — Hồ sơ và gia phả: bảng `family_members`, quan hệ cha mẹ–con và vợ–chồng (chống vòng lặp, trùng lặp, tái hôn),
CRUD hồ sơ với mức hiển thị theo trường, yêu cầu sửa khi đang khóa, cây gia phả tương tác, và nối tài khoản với hồ sơ gia phả.
Trước đó cần bạn chạy phần kiểm tra mục 4 để chắc nền tảng chạy đúng trên Supabase thật.
