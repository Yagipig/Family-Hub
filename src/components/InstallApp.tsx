"use client";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";

// Ghim app (PWA) ra man hinh chinh dien thoai — muc trong Cai dat theo yeu cau nguoi dung 29/10/2026.
// - Android/Chrome: bat su kien beforeinstallprompt de bam 1 cai la hien hop thoai cai dat that.
// - iPhone (Safari khong cho goi lenh cai): hien huong dan tung buoc.
// - Da ghim roi (mo bang app da cai): bao da ghim.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

type Mode = "checking" | "installed" | "prompt" | "ios" | "generic";

export function InstallApp() {
  const [mode, setMode] = useState<Mode>("checking");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) {
      setMode("installed");
      return;
    }
    setMode(/iphone|ipad|ipod/i.test(window.navigator.userAgent) ? "ios" : "generic");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "installed") {
    return (
      <p className="rounded-xl bg-green-50 px-4 py-3 text-base font-medium text-ok">
        ✅ App đã được ghim — bạn đang mở My Family từ biểu tượng trên màn hình chính.
      </p>
    );
  }

  if (mode === "prompt") {
    return (
      <button
        type="button"
        className={buttonClass}
        onClick={async () => {
          if (!deferred) return;
          await deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice.outcome === "accepted") setMode("installed");
        }}
      >
        📌 Ghim My Family ra màn hình chính
      </button>
    );
  }

  if (mode === "ios") {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-base text-ink-soft">
        <li>Bấm nút <strong>Chia sẻ</strong> (hình vuông có mũi tên hướng lên) ở thanh dưới của Safari.</li>
        <li>Chọn <strong>“Thêm vào Màn hình chính”</strong>.</li>
        <li>Bấm <strong>“Thêm”</strong> — biểu tượng My Family sẽ xuất hiện trên màn hình chính.</li>
      </ol>
    );
  }

  return (
    <ol className="list-decimal space-y-1 pl-5 text-base text-ink-soft">
      <li>Bấm nút <strong>⋮</strong> (menu) ở góc phải trên của trình duyệt Chrome.</li>
      <li>Chọn <strong>“Cài đặt ứng dụng”</strong> hoặc <strong>“Thêm vào màn hình chính”</strong>.</li>
      <li>Bấm <strong>“Cài đặt”</strong> — biểu tượng My Family sẽ xuất hiện trên màn hình chính.</li>
    </ol>
  );
}
