import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FiltersProvider } from "@/lib/filters-context";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Northstar Financial — HR Analytics",
  description: "Corporate HR analytics dashboard for Northstar Financial",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      data-theme="light"
    >
      <body
        className={`${inter.className} min-h-full bg-background text-foreground`}
      >
        <FiltersProvider>{children}</FiltersProvider>
      </body>
    </html>
  );
}
