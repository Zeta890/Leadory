import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Leadory — Prospecção comercial inteligente", template: "%s · Leadory" },
  description: "Descubra, audite, qualifique e converta empresas locais com dados licenciados e comunicação consentida.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#090b09", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
