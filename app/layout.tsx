import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Cairn",
  description: "Monitor, diagnose, and forecast any business dataset",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      data-theme="light"
    >
      <body
        className={`${inter.className} min-h-full bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
