import type { Metadata, Viewport } from "next";
import { Golos_Text } from "next/font/google";
import "./globals.css";

const golos = Golos_Text({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-golos",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Обратная связь", template: "%s · Обратная связь" },
  description: "Система обратной связи и предложений сотрудников ГК «Модус Трейд»",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f5f2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={golos.variable}>
      <body>{children}</body>
    </html>
  );
}
