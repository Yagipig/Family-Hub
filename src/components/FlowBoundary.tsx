"use client";
import { Component, type ReactNode } from "react";

/**
 * Khung chắn lỗi cho sơ đồ cây: nếu phần sơ đồ gặp lỗi khi chạy trên máy người dùng
 * (mạng chập chờn, trình duyệt giữ bản cũ...), hiện thông báo rõ ràng kèm nút tải lại
 * thay vì để bảng cây trống im lặng không rõ nguyên nhân.
 */
export class FlowBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-base font-semibold text-ink">Sơ đồ cây chưa tải được trên máy này.</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Có thể do mạng chập chờn hoặc trình duyệt đang giữ bản cũ của app. Bấm nút dưới để tải lại trang.
          </p>
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
