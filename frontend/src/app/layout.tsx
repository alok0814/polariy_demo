import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polarity — Real-Time Media Bias Analysis",
  description: "Where does your source actually stand? Polarity evaluates news across the political spectrum using 8 AI panelists and synthesizes a bias score.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
