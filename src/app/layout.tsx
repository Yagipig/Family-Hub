import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

export const metadata: Metadata = {
  title: { default: "Family Hub", template: "%s · Family Hub" },
  description: "Không gian riêng tư của gia đình",
  robots: { index: false, follow: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Family Hub", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#7b1e2b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh antialiased">{children}<RegisterServiceWorker /><Analytics /><SpeedInsights /></body>
    </html>
  );
}
