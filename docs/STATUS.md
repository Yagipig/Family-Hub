# Trạng thái Family Hub — báo cáo trung thực (cập nhật 28/10/2026)

## Tóm tắt một dòng
Mọi module của MVP và các giai đoạn 2–4 đã được **viết, build được và kiểm thử ở mức CSDL/đơn vị**, nhưng **chưa module nào từng chạy trên một dự án Supabase thật hay trong trình duyệt với dữ liệu thật**. Không dùng cho dữ liệu thật trước khi làm xong mục "Phải kiểm tra tay" bên dưới.

## Đã kiểm chứng được (trong môi trường phát triển)
| Hạng mục | Kết quả |
|---|---|
| Kiểm thử RLS/nghiệp vụ trên Postgres 16 + lớp giả lập Supabase | **1.983 kiểm tra đạt, 0 hỏng** (10 bộ: core 90, members 179, members_ui 71, events 246, cards 287, chat 303, media 457, games 312, data_requests 28, global 10) |
| Kiểm tra toàn cục trên schema đã gộp | mọi bảng bật RLS; anon không có quyền nào; chỉ `branches/families/user_profiles` ghi trực tiếp được (RLS vẫn áp dụng); hàm nội bộ/cron không gọi được bằng tài khoản thường; mọi hàm security definer có search_path cố định |
| Kiểm thử đơn vị (vitest) | 426 đạt / 39 tệp (âm lịch đối chiếu `lunar-javascript` + mốc Tết Việt Nam, AES-GCM, commit–reveal, lô tô, bầu cua RTP 92,13%, đồ thị gia phả, ICS, CSV…) |
| `tsc --noEmit`, `next build` (Turbopack) | sạch; 60+ route |
| Đột biến (cố ý phá code để xem test có bắt không) | do từng module tự thực hiện, hàng chục biến thể; hầu hết bị bắt (chi tiết trong báo cáo từng module) |
| Trình duyệt thật (Chromium) | chỉ trang đăng nhập: không lỗi CSP, service worker đăng ký được |

**Đã bắt được lỗi thật nhờ kiểm thử:** so sánh NULL làm quản trị nhánh chưa gắn hồ sơ sửa được hồ sơ nhánh khác (đã sửa); hai module cùng đặt tên hàm `resolve_report` (đã đổi tên bên bài viết thành `resolve_post_report`); xuất JSON để lọt `branch_id` do thứ tự toán tử (đã sửa).

## Chưa kiểm chứng (RỦI RO còn lại)
- Supabase thật: Auth (đăng nhập, lời mời, MFA), PostgREST (serialize `smallint[]`, `or()` có regex), Storage (chính sách `storage.objects`, `metadata.size`), Realtime (RLS theo người đăng ký), quyền khi áp migration trên Supabase (policy trên `storage.objects`, `alter default privileges`).
- Giao diện trong trình duyệt: cây gia phả (cảm ứng, hiệu năng 1000 người), hiệu ứng thiệp, tải ảnh lên, PNG xuất cây, in PDF, trình chiếu TV, Realtime chat.
- Vercel Cron thật (1 lần/ngày, trễ tới ~1 giờ), CSP với tên miền Supabase thật.
- Lớp giả lập Supabase trong test khác Supabase thật ở các chi tiết (`auth.uid()`, vai trò, `storage`).

## Module và quyết định thiết kế
- **Nền tảng (Đợt 1)**: không đăng ký công khai; lời mời một lần (chỉ lưu băm); 5 vai trò; ma trận quyền `role_permissions`; Branch Admin giới hạn theo nhánh; khóa/mở chỉnh sửa (toàn gia đình hoặc từng nhánh, có hạn tự đóng); MFA bắt buộc cho khu Quản trị; nhật ký bất biến.
- **Thành viên & gia phả**: hồ sơ có 4 mức hiển thị (cả nhà/nhánh/chỉ quản trị) cho ngày sinh, ngày mất, liên hệ, ảnh; trẻ em < 18 tuổi bị hạ về tối đa "nhánh"; chủ hồ sơ luôn sửa được hồ sơ mình (kể cả khi khóa; **khách thì không**); thành viên khác gửi yêu cầu sửa khi khóa; chặn vòng lặp cha–con, tối đa 2 cha mẹ ruột, trùng quan hệ; xóa mềm + thùng rác; gắn tài khoản ↔ hồ sơ; nhập/xuất JSON, xuất CSV có chặn công thức; cây React Flow + dagre + chế độ danh sách theo đời.
- **Lịch/sinh nhật/giỗ**: âm lịch Việt Nam tự viết (UTC+7), bảng tra 1900–2100 trong CSDL cho thông báo, 5 tháng xấp xỉ có thể lệch 1 ngày so với thiên văn thực; thông báo "hôm nay" theo múi giờ từng người nhận, chỉ về hồ sơ họ được thấy ngày; RSVP; xuất `.ics`; chọn quốc gia → múi giờ (50 nước).
- **Thiệp & lì xì**: 11 mẫu thiệp SVG/CSS tự vẽ; hẹn giờ giao "lười" bằng RLS; lì xì chỉ GHI NHẬN (không chuyển tiền): đã hẹn → người gửi bấm "đã chuyển" → người nhận bấm "đã nhận"; thông tin nhận tiền mã hóa AES-256-GCM ở tầng ứng dụng, che mặc định, chia sẻ có hạn cho người cụ thể, mỗi lần xem có nhật ký, **quản trị viên không xem được nội dung**. Chặn nhập số thẻ (Luhn + đầu số mạng thẻ) và từ khóa mật khẩu/OTP/PIN.
- **Chat**: nhóm cả nhà/nhóm nhánh/nhóm tùy chọn/nhắn riêng; khách không chat; rời/bị gỡ mất toàn bộ quyền đọc nhóm, thêm lại chỉ thấy từ lúc thêm; xóa mềm xóa sạch nội dung; sửa trong 15 phút; giới hạn tần suất; báo cáo → quản trị chỉ thấy bản chụp tin được báo cáo (không đọc được nhóm mình không tham gia). **Chưa có tệp đính kèm; tìm kiếm chỉ theo tên người/nhóm.**
- **Ảnh/album/bảng tin**: bucket riêng tư + URL ký (1 giờ); ảnh nén phía trình duyệt, xóa EXIF phía máy chủ bằng `sharp`, chặn SVG; hạn mức theo gia đình; ảnh bìa/nền cho cả nhà; album theo từng thành viên mọi người đều xem, chủ album tự thêm ảnh bất cứ lúc nào (nội dung cá nhân, không bị khóa chỉnh sửa); bảng tin có bình luận, cảm xúc, ghim, báo cáo và kiểm duyệt.
- **Trò chơi** (chỉ điểm ảo "Điểm vui — không có giá trị tiền"): mặc định TẮT; khách không chơi; lì xì may mắn, xổ số (commit–reveal kiểm chứng được), lô tô (server xác nhận kinh), bầu cua (giới hạn thua/ngày), trình chiếu TV; sổ điểm chỉ-thêm.
- **Dữ liệu cá nhân**: thành viên tải về dữ liệu của mình (có nhật ký) và gửi yêu cầu xin bản sao/sửa/hạn chế/xóa; quản trị xử lý bằng tay và hệ thống báo lại; xóa hồ sơ cần xác minh trực tiếp. Có trang nhật ký hoạt động cho quản trị.
- **PWA**: manifest + biểu tượng PNG + service worker tối giản (chỉ trang ngoại tuyến và tài nguyên tĩnh; **không lưu đệm dữ liệu đăng nhập**).
- **Bảo mật web**: CSP, HSTS, X-Frame-Options, cron xác thực Bearer + so sánh thời gian hằng.

## Vấn đề tồn tại / việc chưa làm
1. Chưa có xác minh email và **chưa có "quên mật khẩu"** (email Supabase Free bị giới hạn). Tạm thời quản trị đặt lại mật khẩu ở Supabase Dashboard.
2. Không giới hạn tần suất đăng nhập ngoài giới hạn mặc định của Supabase Auth.
3. Phiên (JWT) còn hiệu lực đến hết hạn sau khi thu hồi tài khoản (RLS và `getSession` chặn ngay, nhưng URL ảnh đã ký còn sống đến hết 1 giờ).
4. Quay xổ số/ván bầu cua tự động đúng giờ chỉ xảy ra khi có người mở trang (Hobby không có cron chính xác) — hoặc quản trị bấm quay.
5. Thông báo "hôm nay" tạo bởi cron hằng ngày: người ở múi giờ rất lệch (Nhật/Mỹ) có thể nhận lệch nửa ngày.
6. Hai bản logic sinh nhật/giỗ (TypeScript và SQL `_member_hits_on`) phải giữ đồng bộ; có kịch bản test chung nhưng không có cơ chế ép.
7. Khóa mã hóa `PAYOUT_ENC_KEY`: chưa có xoay khóa (có cột `key_version`); mất khóa = mất dữ liệu nhận tiền.
8. Số tài khoản ngân hàng bị nhận nhầm là số thẻ (Luhn + đầu số) sẽ bị từ chối: người dùng phải nhắn trực tiếp.
9. Cây gia phả > vài trăm người: chữ nhỏ khi xem toàn bộ; xuất PNG chụp khung hiện tại.
10. Realtime cho bảng tin chưa bật (tải lại trang); chưa có cảm xúc cho bình luận trong giao diện; chưa chọn ảnh bìa album bằng giao diện.
11. Chưa có đa ngôn ngữ vi/ja (cột `locale` đã có, chuỗi giao diện đang là tiếng Việt cố định).
12. Giao diện dùng thành phần Tailwind tự viết, không phải shadcn/ui.
13. Nhập gia phả JSON luôn THÊM mới (không gộp/ghi đè); giới hạn 4,5 MB do Vercel Hobby.
14. Trang nhật ký (/admin/nhat-ky) chỉ hiện tên trường đã đổi, không hiện giá trị; chưa có trạng thái sao lưu hiển thị trong ứng dụng (xem tab Actions của GitHub).
15. Ảnh trong Storage không nằm trong bản sao lưu tự động.

## Phải kiểm tra tay trước khi dùng thật (trên dự án thử, ≥ 3 tài khoản + 1 tài khoản bị thu hồi)
Danh sách chi tiết do từng module đề xuất; tóm tắt:
1. Đăng nhập, mời bằng liên kết, đăng ký MFA, vào /admin chỉ khi đủ aal2; thu hồi tài khoản → mất quyền ngay.
2. Khóa/mở chỉnh sửa (toàn gia đình, nhánh, hết hạn) và luồng yêu cầu sửa → duyệt/từ chối.
3. Thêm thành viên, cha mẹ (thử tạo vòng lặp), vợ/chồng, xóa/khôi phục; cây gia phả trên điện thoại; nhập/xuất.
4. Sinh nhật/giỗ âm–dương, đổi múi giờ, gọi cron hai lần liên tiếp (lần hai không tạo trùng); xuất `.ics` vào Google/Apple Calendar.
5. Thiệp (gửi ngay/hẹn giờ/mở), lì xì (luồng trạng thái), nhập thông tin nhận tiền (thẻ giả bị chặn), chia sẻ/thu hồi, xác nhận quản trị không thấy nội dung.
6. Chat hai trình duyệt (Realtime, mất mạng, nối lại), báo cáo/ẩn tin, thu hồi → mất quyền đọc.
7. Tải ảnh có GPS (kiểm tra đã xóa EXIF), file .svg/đổi đuôi bị chặn, hạn mức, album của người khác, khách chỉ xem.
8. Trò chơi: bật/tắt, bốc lì xì hai lần, xổ số kiểm chứng seed, lô tô kinh sớm bị từ chối, bầu cua khóa khi chạm giới hạn, khách bị chặn.
9. PWA: cài lên màn hình chính, tắt mạng → trang "Chưa có kết nối mạng".
10. Sao lưu GitHub Actions chạy được và `restore-verify.sh` khôi phục thành công.
