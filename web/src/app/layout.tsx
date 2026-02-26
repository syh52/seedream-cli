import type { Metadata } from "next";
import { Syne, Space_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { GlobalInputBar } from "@/components/layout/GlobalInputBar";
import { TabBar } from "@/components/layout/TabBar";
import "./globals.css";

// Primary display font - geometric, modern, distinctive
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// Monospace font for data, stats, technical labels
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "SeeDream - AI Image Generator",
  description: "Generate beautiful images with SeeDream AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${spaceMono.variable} font-sans antialiased bg-[#0d0e12] text-white pb-28`}
      >
        <Providers>
          {children}
          <GlobalInputBar />
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
