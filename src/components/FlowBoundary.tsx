"use client";
import { Component, type ReactNode } from "react";

/**
 * Khung chắn lỗi cho sơ đồ cây: nếu phần sơ đồ gặp lỗi khi chạy trên máy người dùng
 * (mạng chập chờn, trình duyệt giữ bản cũ...), hiện thông báo rõ ràng kèm nút tải lại
 * thay vì để bảng cây trống im lặng không rõ nguyên nhân.
 * Nguyên văn lỗi được hiện luôn để người dùng chụp màn hình gửi hỗ trợ chẩn đoán.
 */
export class FlowBoundary extends Component<{ children: ReactNode }, { failed: boolean; message: string }> {
  state = { failed: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return {
      failed: true,
      message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-base font-semibold text-ink">Sơ đồ cây chưa tải được trên máy này.</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Có thể do mạng chập chờn hoặc trình duyệt đang giữ bản cũ của app. Bấm nút dưới để tải lại trang.
          </p>
          {this.state.message && (
            <p className="max-w-sm break-words rounded-xl bg-red-50 px-3 py-2 font-mono text-[11px] leading-snug text-red-800">
              {this.state.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-full border border-[#c9932f] bg-gradient-to-b from-[#ffe9a8] to-[#e9bc57] px-5 text-[15px] font-bold text-[#5d3a17] shadow"
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
