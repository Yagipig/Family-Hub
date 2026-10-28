# Quy ước kỹ thuật Family Hub (bắt buộc cho mọi module)

Ngôn ngữ giao diện, thông báo lỗi, chú thích SQL/test: **tiếng Việt**. Tên bảng/cột/hàm: tiếng Anh, snake_case.

## 1. Cơ sở dữ liệu (Supabase/Postgres)
- Mỗi module = một hoặc nhiều file `supabase/migrations/<số>_<tên>.sql` trong **dải số riêng** của module. Không sửa migration của module khác; không sửa migration đã có (trừ khi là lỗi thật, và phải báo rõ).
- Mọi bảng: `enable row level security`; **không cấp quyền ghi trực tiếp** cho `anon/authenticated`. Mặc định (đã đặt bằng `alter default privileges`) bảng/hàm mới KHÔNG được cấp gì — phải `grant` tường minh, tối thiểu. KHÔNG dùng lệnh `revoke execute on all functions ...` hàng loạt (migration Đợt 2 đã làm một lần; làm lại sẽ làm mất quyền của hàm khác).
- Ghi dữ liệu qua hàm `security definer` với `set search_path = public`, luôn kiểm tra: `auth.uid() is not null`, thành viên **đang hoạt động** của đúng gia đình, và quyền qua `public.has_permission(family, module, action, branch)`. Việc đọc dữ liệu có che trường nhạy cảm đi qua **view** (xem `members_view`) hoặc policy `select` dùng `has_permission`/`is_family_member`.
- Cẩn thận logic NULL trong `if not (a or b)` — dùng `coalesce(..., false)` (đã từng gây lỗi thật).
- Quyền mới: thêm dòng vào `public.permissions` và `public.role_permissions` (vai trò: super_admin luôn được; family_admin thường tất cả; branch_admin theo nhánh (scope_limited); member; guest). `has_permission` đã tự xử lý phạm vi nhánh.
- Xóa mềm (`deleted_at`) cho dữ liệu người dùng tạo. Nhật ký: `public.write_audit(family, action, entity_type, entity_id, before, after)` cho mọi thao tác nhạy cảm (đổi quyền, duyệt, xóa, xem thông tin riêng tư, xuất dữ liệu).
- Thông báo: `public._notify(family, user, kind, title, body, link, dedupe_key)` (nội bộ; chỉ gọi từ hàm security definer hoặc job service_role; `link` chỉ nhận đường dẫn nội bộ bắt đầu bằng `/`). `kind` hiện cho phép: birthday, death_anniversary, event, event_reminder, card, gift, chat, change_request, system — cần loại mới thì nới CHECK bằng migration của module (drop/add constraint) và bổ sung tuỳ chọn trong `_notify` nếu cần.
- Hàm cho job chạy bằng `service_role`: `grant execute ... to service_role` tường minh; không cấp cho authenticated nếu không cần.
- Không lưu mật khẩu, PIN, OTP, số thẻ. Không có chuyển tiền thật. Không có cá cược tiền thật.

## 2. Kiểm thử RLS (bắt buộc)
- Mỗi module có `supabase/tests/rls_<module>.sql`, chạy bằng `supabase/tests/run_rls_tests.sh` (mỗi file chạy trên CSDL mới với đủ migration). Dùng `\ir rls_fixture.sql` để có dữ liệu mẫu chuẩn (xem đầu file đó: 8 tài khoản, 3 nhánh) và `rls_helpers.sql` (`t.as_user/as_anon/as_root`, `t.ok`, `t.fails`). Xem `rls_members.sql` làm mẫu (tạo bảng `t.ids`, `t.id('khóa')`, `t.cnt(sql)`).
- Phải có test: người ngoài / tài khoản thu hồi / anon bị chặn; vai trò thấp không làm được việc của vai trò cao; phạm vi nhánh; ghi trực tiếp vào bảng bị từ chối; hàm nội bộ không gọi được bằng authenticated; nhật ký được ghi; ràng buộc dữ liệu; chống trùng.
- Test thật sự phải có khả năng thất bại (không dùng `or true`). Kết thúc file bằng khối "Tổng kết" như các file mẫu.
- Chạy: `chmod -R a+rX /home/claude/family-hub && su postgres -c "cd /tmp && <đường dẫn>/supabase/tests/run_rls_tests.sh"` (khởi động Postgres nếu cần: `pg_ctlcluster 16 main start`).

## 3. Web (Next.js 16 App Router + TypeScript + Tailwind v4)
- Trang trong `src/app/(app)/<module>/...`; logic dùng chung trong `src/lib/<module>.ts` (hoặc thư mục). `params`/`searchParams` là Promise; `cookies()` async; `src/proxy.ts` thay middleware.
- Mỗi trang/Server Action bắt đầu bằng `requireSession()` (hoặc `requireAdmin(next)` cho trang quản trị — đòi MFA). Kiểm tra quyền thật bằng RPC/RLS, không chỉ ẩn nút. Dùng `createClient()` (`@/lib/supabase/server`, chạy với quyền người dùng). `createAdminClient()` (service_role) CHỈ dùng trong route job/cron có xác thực bí mật, không bao giờ trong trang hoặc component client.
- Kiểm tra đầu vào bằng zod (đặt schema trong file của module, không sửa `src/lib/schemas.ts` chung trừ khi thêm cuối file). Lỗi trả về tiếng Việt qua `friendlyError` (`src/lib/format.ts`) — không lộ chi tiết nội bộ.
- UI: dùng `src/components/ui.tsx` (Card, Alert, Field, SelectField, buttonClass, buttonGhostClass) và `SubmitButton`/`ConfirmButton`. Màu: be/đỏ rượu/champagne (token Tailwind `cream, ivory, wine, wine-dark, champagne, champagne-soft, ink, ink-soft, danger, ok`). Phông to (html 18px), vùng bấm ≥ 48px, tương phản cao, nhãn rõ cho người lớn tuổi. Responsive (điện thoại trước). Có `aria-label`, `role`, focus rõ.
- Không dùng localStorage cho dữ liệu quan trọng. Không để khóa bí mật vào biến `NEXT_PUBLIC_*`.
- Đừng sửa `src/lib/nav.ts`, `src/app/(app)/layout.tsx`, `package.json`: nêu trong báo cáo cần bật mục menu / cần thêm dependency nào để tích hợp viên làm.
- Kiểm tra bằng `npx tsc --noEmit`. (`next build` do người tích hợp chạy.)

## 4. Trung thực khi báo cáo
- Chỉ ghi "xong" khi đã cài đặt VÀ kiểm thử được. Nêu rõ phần nào chỉ kiểm tra ở mức SQL/tsc mà chưa chạy với Supabase thật.
