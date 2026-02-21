import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FactCheck Debate | 政治ニュース多角的分析",
  description: "URLを入力すると複数の視点のエージェントがニュースを議論・分析します",
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
