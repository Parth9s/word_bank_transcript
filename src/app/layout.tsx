import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WordBank — Vocabulary Learning",
  description:
    "Upload transcripts, analyze vocabulary frequency, and build your personal word bank through keyboard-driven review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
