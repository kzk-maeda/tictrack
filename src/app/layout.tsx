import type { Metadata } from "next";
import "./globals.css";
import { AmplifyProvider } from "@/components/providers/amplify-provider";

export const metadata: Metadata = {
  title: "TicTrack",
  description: "介護者ファーストの、子どものチック症状を記録・分析する非診断アプリ",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AmplifyProvider>{children}</AmplifyProvider>
      </body>
    </html>
  );
}
