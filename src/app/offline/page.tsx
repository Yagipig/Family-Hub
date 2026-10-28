export const metadata = { title: "Không có mạng" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-bold text-wine">Chưa có kết nối mạng</h1>
      <p className="text-lg text-ink-soft">
        Family Hub cần Internet để hiển thị gia phả và tin nhắn của gia đình. Vì sự riêng tư, dữ liệu gia đình không được lưu lại trên máy khi ngoại tuyến.
      </p>
      <p className="text-lg">Hãy kiểm tra Wi-Fi hoặc 4G rồi mở lại ứng dụng.</p>
    </main>
  );
}
