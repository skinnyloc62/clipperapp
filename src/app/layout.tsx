import type { Metadata } from "next";
import "./globals.css";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Street Ethics Clip Engine",
  description: "AI-assisted clipping pipeline: monitor, cut, score, render, approve.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=JetBrains+Mono:wght@400..600&family=Sora:wght@400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly et al.) stamp
          attributes onto <body> before React hydrates. Without this the mismatch
          throws a console error that has nothing to do with the app. */}
      <body className="antialiased" suppressHydrationWarning>
        <SpaceBackdrop />
        <div className="relative z-10">
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
