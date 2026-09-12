import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "랜덤능력체스 | Random Chess",
  description: "17가지 능력으로 뒤집는 체스. 로컬 2인과 방 코드 온라인 대전.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "랜능체", statusBarStyle: "black-translucent" },
  icons: {
    apple: "/icon-192.png",
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = { themeColor: "#111419", width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
