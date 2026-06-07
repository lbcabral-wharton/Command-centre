import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { auth } from "@/lib/auth";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Command Centre",
  description: "Personal · Finance · Ventures",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Command Centre",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAuthRoute =
    typeof window === "undefined" &&
    // Server-side check handled by middleware; layout just wraps
    false;

  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} font-sans`}>
        {session && <Nav />}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
